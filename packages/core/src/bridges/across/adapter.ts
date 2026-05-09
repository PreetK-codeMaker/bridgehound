import type { Address, DecodeEventLogReturnType, Log } from 'viem'
import { decodeEventLog, encodeEventTopics } from 'viem'
import { fetchTx } from '../../chains/fetchTx.js'
import type { BridgeSend, ChainId, NormalizedTx, TokenInfo } from '../../types.js'
import { BridgeDecodeError } from '../../utils/errors.js'
import { BLOCKS_PER_SECOND, DESTINATION_LOOKBACK_BLOCKS, LOG_SCAN_CHUNK } from '../lookback.js'
import type { AdapterContext, BridgeAdapter } from '../types.js'
import { FILLED_RELAY_EVENT, FUNDS_DEPOSITED_EVENT } from './abi.js'
import { SPOKE_POOL } from './addresses.js'
import { bytes32ToAddressOrNull } from './codec.js'

type FundsDepositedDecoded = DecodeEventLogReturnType<
  [typeof FUNDS_DEPOSITED_EVENT],
  'FundsDeposited'
>

const BRIDGE_NAME = 'across'

class AcrossAdapter implements BridgeAdapter {
  readonly name = BRIDGE_NAME

  matches(chainId: ChainId, contract: Address): boolean {
    const expected = SPOKE_POOL[chainId]
    if (!expected) return false
    return contract.toLowerCase() === expected.toLowerCase()
  }

  parseSend(tx: NormalizedTx, logs: readonly Log[]): BridgeSend | null {
    const spoke = SPOKE_POOL[tx.chainId]
    if (!spoke) return null

    const topic0 = encodeEventTopics({
      abi: [FUNDS_DEPOSITED_EVENT],
      eventName: 'FundsDeposited',
    })[0]

    const candidate = logs.find(
      (log) =>
        log.address.toLowerCase() === spoke.toLowerCase() &&
        log.topics[0]?.toLowerCase() === topic0.toLowerCase(),
    )
    if (!candidate) return null

    let decoded: FundsDepositedDecoded
    try {
      decoded = decodeEventLog({
        abi: [FUNDS_DEPOSITED_EVENT],
        eventName: 'FundsDeposited',
        data: candidate.data,
        topics: candidate.topics,
      })
    } catch (err) {
      throw new BridgeDecodeError(`Failed to decode Across FundsDeposited log on ${tx.hash}`, err)
    }

    const args = decoded.args

    const rawDstChain = args.destinationChainId
    if (rawDstChain > BigInt(Number.MAX_SAFE_INTEGER)) return null
    const dstChain = Number(rawDstChain)
    const inputAmount = args.inputAmount
    const depositId = args.depositId
    const fillDeadline = args.fillDeadline

    const recipient = bytes32ToAddressOrNull(args.recipient)
    const inputToken = bytes32ToAddressOrNull(args.inputToken)
    if (recipient === null || inputToken === null) {
      // Non-EVM destination (e.g. Solana). We don't trace those yet.
      return null
    }

    const token: TokenInfo = {
      address: inputToken,
      chainId: tx.chainId,
    }

    const minDelay = 60
    const derived = Number(fillDeadline) - tx.timestamp
    const cap = 6 * 60 * 60
    const maxDelay = derived > minDelay ? Math.min(derived, cap) : cap

    return {
      bridge: BRIDGE_NAME,
      srcChain: tx.chainId,
      dstChain,
      recipient,
      token,
      amount: inputAmount,
      messageId: depositId.toString(),
      timestamp: tx.timestamp,
      expectedDelaySeconds: [minDelay, maxDelay],
    }
  }

  async findDestination(
    send: BridgeSend,
    ctx: AdapterContext,
  ): Promise<NormalizedTx | null> {
    if (!send.messageId) return null
    const messageId = send.messageId
    const dstSpoke = SPOKE_POOL[send.dstChain]
    if (!dstSpoke) return null

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
          address: dstSpoke,
          event: FILLED_RELAY_EVENT,
          args: {
            originChainId: BigInt(send.srcChain),
            depositId: BigInt(messageId),
          },
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

export const acrossAdapter: BridgeAdapter = new AcrossAdapter()
