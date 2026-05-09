import type { Address, Hash, Log } from 'viem'
import { decodeEventLog, encodeEventTopics, isHex } from 'viem'
import { fetchTx } from '../../chains/fetchTx.js'
import type { BridgeSend, ChainId, NormalizedTx, TokenInfo } from '../../types.js'
import { BridgeDecodeError } from '../../utils/errors.js'
import { DESTINATION_LOOKBACK_BLOCKS } from '../lookback.js'
import type { AdapterContext, BridgeAdapter } from '../types.js'
import { OFT_RECEIVED_EVENT, OFT_SENT_EVENT } from './abi.js'
import { EID_TO_CHAIN_ID, STARGATE_OFTS, isStargateContract } from './addresses.js'

const BRIDGE_NAME = 'stargate'

class StargateAdapter implements BridgeAdapter {
  readonly name = BRIDGE_NAME

  matches(chainId: ChainId, contract: Address): boolean {
    return isStargateContract(chainId, contract)
  }

  parseSend(tx: NormalizedTx, logs: readonly Log[]): BridgeSend | null {
    if (!tx.to) return null
    if (!isStargateContract(tx.chainId, tx.to)) return null

    const topic0 = encodeEventTopics({ abi: [OFT_SENT_EVENT], eventName: 'OFTSent' })[0]
    const candidate = logs.find(
      (log) =>
        log.topics[0]?.toLowerCase() === topic0.toLowerCase() &&
        isStargateContract(tx.chainId, log.address),
    )
    if (!candidate) return null

    let decoded: ReturnType<typeof decodeEventLog>
    try {
      decoded = decodeEventLog({
        abi: [OFT_SENT_EVENT],
        data: candidate.data,
        topics: candidate.topics,
      })
    } catch (err) {
      throw new BridgeDecodeError(`Failed to decode Stargate OFTSent log on ${tx.hash}`, err)
    }

    if (decoded.eventName !== 'OFTSent') return null
    const args = decoded.args as Record<string, unknown>

    const dstEid = args['dstEid'] as number
    const dstChain = EID_TO_CHAIN_ID[dstEid]
    if (!dstChain) {
      // Destination chain isn't one we trace (might be Solana, Aptos, …).
      return null
    }

    const guid = args['guid'] as `0x${string}`
    const amount = args['amountSentLD'] as bigint

    // The OFT contract emitted the event, but for pool-based OFTs (USDC, USDT)
    // the OFT address is *not* the underlying ERC-20 — it's the bridge wrapper.
    // Resolving the underlying token requires an RPC call we don't want to
    // make in this hot path. Null-out `token.address` so downstream consumers
    // don't compare it against real token addresses, and stash the OFT contract
    // on `sourceContract` instead. (Same pattern as Hop.)
    const token: TokenInfo = {
      address: null,
      symbol: '?',
      decimals: 0,
      chainId: tx.chainId,
    }

    return {
      bridge: BRIDGE_NAME,
      srcChain: tx.chainId,
      dstChain,
      // OFT recipient sits in the LayerZero message payload, not the event;
      // decoding it requires reading `_lzReceive` calldata on the destination.
      // Leave `recipient` unset rather than fabricate it — matching by
      // GUID + dstEid is exact, so the destination tx still resolves.
      token,
      amount,
      messageId: guid,
      sourceContract: candidate.address,
      timestamp: tx.timestamp,
      // LayerZero deliveries: typically <5 min, occasionally hours.
      expectedDelaySeconds: [60, 6 * 60 * 60],
    }
  }

  async findDestination(send: BridgeSend, ctx: AdapterContext): Promise<NormalizedTx | null> {
    if (!send.messageId) return null
    if (!isHex(send.messageId, { strict: true }) || send.messageId.length !== 66) return null
    const guid = send.messageId
    const dstOFTs = STARGATE_OFTS[send.dstChain]
    if (!dstOFTs || dstOFTs.length === 0) return null

    const matchingLog = await ctx.providers.run(send.dstChain, async () => {
      const client = ctx.providers.client(send.dstChain)
      const head = await client.getBlockNumber()
      const lookback = DESTINATION_LOOKBACK_BLOCKS[send.dstChain] ?? 50_000n
      const fromBlock = head > lookback ? head - lookback : 0n

      // viem's getLogs takes a single address or a mutable array; OFTs
      // differ per token, so we pass the array and filter by guid.
      const logs = await client.getLogs({
        address: [...dstOFTs],
        event: OFT_RECEIVED_EVENT,
        args: { guid },
        fromBlock,
        toBlock: head,
      })
      return logs[0] ?? null
    })

    if (!matchingLog) return null
    const fillTxHash = matchingLog.transactionHash
    if (!fillTxHash) return null

    return fetchTx(ctx.providers, ctx.cache, send.dstChain, fillTxHash as Hash)
  }
}

export const stargateAdapter: BridgeAdapter = new StargateAdapter()
