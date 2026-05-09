import type { Address, DecodeEventLogReturnType, Log } from 'viem'
import { decodeEventLog, encodeEventTopics, isHex } from 'viem'
import { fetchTx } from '../../chains/fetchTx.js'
import type { BridgeSend, ChainId, NormalizedTx, TokenInfo } from '../../types.js'
import { BridgeDecodeError } from '../../utils/errors.js'
import { BLOCKS_PER_SECOND, DESTINATION_LOOKBACK_BLOCKS, LOG_SCAN_CHUNK } from '../lookback.js'
import type { AdapterContext, BridgeAdapter } from '../types.js'
import { TRANSFER_SENT_EVENT, WITHDRAWAL_BONDED_EVENT } from './abi.js'
import { HOP_CONTRACTS, isHopContract } from './addresses.js'

type TransferSentDecoded = DecodeEventLogReturnType<
  [typeof TRANSFER_SENT_EVENT],
  'TransferSent'
>

const BRIDGE_NAME = 'hop'

class HopAdapter implements BridgeAdapter {
  readonly name = BRIDGE_NAME

  matches(chainId: ChainId, contract: Address): boolean {
    return isHopContract(chainId, contract)
  }

  supportedChains(): readonly ChainId[] {
    return Object.keys(HOP_CONTRACTS)
      .map(Number)
      .filter((id) => HOP_CONTRACTS[id]!.length > 0)
  }

  parseSend(tx: NormalizedTx, logs: readonly Log[]): BridgeSend | null {
    if (!tx.to) return null
    if (!isHopContract(tx.chainId, tx.to)) return null

    // Find a TransferSent log; absent (e.g. on L1→L2 sends, which emit
    // TransferSentToL2 with no transferId) means we can't follow this
    // deterministically.
    const topic0 = encodeEventTopics({
      abi: [TRANSFER_SENT_EVENT],
      eventName: 'TransferSent',
    })[0]

    const candidate = logs.find(
      (log) =>
        log.topics[0]?.toLowerCase() === topic0.toLowerCase() &&
        isHopContract(tx.chainId, log.address),
    )
    if (!candidate) return null

    let decoded: TransferSentDecoded
    try {
      decoded = decodeEventLog({
        abi: [TRANSFER_SENT_EVENT],
        eventName: 'TransferSent',
        data: candidate.data,
        topics: candidate.topics,
      })
    } catch (err) {
      throw new BridgeDecodeError(`Failed to decode Hop TransferSent log on ${tx.hash}`, err)
    }

    const args = decoded.args

    const rawDstChain = args.chainId
    if (rawDstChain > BigInt(Number.MAX_SAFE_INTEGER)) return null
    const dstChain = Number(rawDstChain)
    const recipient = args.recipient
    const amount = args.amount
    const transferId = args.transferId

    // The Hop bridge contract is per-token, but its address is the bridge
    // contract — not the underlying ERC-20. Resolving the real token requires
    // an RPC call (`l2CanonicalToken()`), which `parseSend` is too hot a path
    // for. Null-out `token.address` so downstream consumers don't compare it
    // against real token addresses, and stash the bridge contract on
    // `sourceContract` instead.
    const token: TokenInfo = {
      address: null,
      chainId: tx.chainId,
    }

    return {
      bridge: BRIDGE_NAME,
      srcChain: tx.chainId,
      dstChain,
      recipient,
      token,
      amount,
      messageId: transferId,
      sourceContract: candidate.address,
      timestamp: tx.timestamp,
      // Bonded paths usually arrive in minutes; un-bonded settlement after
      // the challenge period can take ~24h.
      expectedDelaySeconds: [60, 24 * 60 * 60],
    }
  }

  async findDestination(send: BridgeSend, ctx: AdapterContext): Promise<NormalizedTx | null> {
    if (!send.messageId) return null
    // transferId is a 32-byte hash, so messageId here must be 0x-hex. Bail
    // early on anything else rather than letting viem's getLogs throw deep
    // inside arg encoding.
    if (!isHex(send.messageId, { strict: true }) || send.messageId.length !== 66) return null
    // We only match the bonded-fast path (`WithdrawalBonded`). Un-bonded
    // settlement after the challenge period emits `Withdrew`, which we
    // don't handle yet — a follow-up, paralleling the L1→L2 parseSend gap
    // noted above. In practice the bonder fronts almost every transfer, so
    // unbonded paths are rare.
    const transferId = send.messageId
    const dstContracts = HOP_CONTRACTS[send.dstChain]
    if (!dstContracts || dstContracts.length === 0) return null

    const matchingLog = await ctx.providers.run(send.dstChain, async () => {
      const client = ctx.providers.client(send.dstChain)
      const head = await client.getBlockNumber()
      const lookback = DESTINATION_LOOKBACK_BLOCKS[send.dstChain] ?? 50_000n
      const rawEarliest = head > lookback ? head - lookback : 0n
      const blocksPerSecond = BLOCKS_PER_SECOND[send.dstChain] ?? 1
      const elapsedSeconds = Math.max(0, Math.floor(Date.now() / 1000) - send.timestamp)
      const elapsedBlocks = BigInt(Math.ceil(elapsedSeconds * blocksPerSecond))
      const timestampBound = head > elapsedBlocks ? head - elapsedBlocks : 0n
      const earliest = timestampBound > rawEarliest ? timestampBound : rawEarliest

      let toBlock = head
      while (toBlock >= earliest) {
        const fromBlock =
          toBlock > earliest + LOG_SCAN_CHUNK - 1n ? toBlock - LOG_SCAN_CHUNK + 1n : earliest
        const logs = await client.getLogs({
          address: [...dstContracts],
          event: WITHDRAWAL_BONDED_EVENT,
          args: { transferId },
          fromBlock,
          toBlock,
        })
        if (logs.length > 0) return logs[0] ?? null
        if (fromBlock === earliest) break
        toBlock = fromBlock - 1n
      }
      return null
    })

    if (!matchingLog) return null
    const fillTxHash = matchingLog.transactionHash
    if (!fillTxHash) return null

    return fetchTx(ctx.providers, ctx.cache, send.dstChain, fillTxHash)
  }
}

export const hopAdapter: BridgeAdapter = new HopAdapter()
