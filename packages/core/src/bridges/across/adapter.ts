import type { Address, Hash, Log } from 'viem'
import { decodeEventLog, encodeEventTopics } from 'viem'
import { fetchTx } from '../../chains/fetchTx.js'
import type { BridgeSend, ChainId, NormalizedTx, TokenInfo } from '../../types.js'
import { BridgeDecodeError } from '../../utils/errors.js'
import { DESTINATION_LOOKBACK_BLOCKS } from '../lookback.js'
import type { AdapterContext, BridgeAdapter } from '../types.js'
import { FILLED_RELAY_EVENT, FUNDS_DEPOSITED_EVENT } from './abi.js'
import { SPOKE_POOL } from './addresses.js'
import { bytes32ToAddress } from './codec.js'

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

    let decoded: ReturnType<typeof decodeEventLog>
    try {
      decoded = decodeEventLog({
        abi: [FUNDS_DEPOSITED_EVENT],
        data: candidate.data,
        topics: candidate.topics,
      })
    } catch (err) {
      throw new BridgeDecodeError(`Failed to decode Across FundsDeposited log on ${tx.hash}`, err)
    }

    if (decoded.eventName !== 'FundsDeposited') return null
    const args = decoded.args as Record<string, unknown>

    const rawDstChain = args['destinationChainId'] as bigint
    if (rawDstChain > BigInt(Number.MAX_SAFE_INTEGER)) return null
    const dstChain = Number(rawDstChain)
    const inputAmount = args['inputAmount'] as bigint
    const depositId = args['depositId'] as bigint

    let recipient: Address
    let inputToken: Address
    try {
      recipient = bytes32ToAddress(args['recipient'] as `0x${string}`)
      inputToken = bytes32ToAddress(args['inputToken'] as `0x${string}`)
    } catch {
      // Non-EVM destination (e.g. Solana). We don't trace those yet — let the
      // caller treat this as "not a bridge send we can follow."
      return null
    }

    const token: TokenInfo = {
      address: inputToken,
      // Symbol/decimals enrichment is a follow-up; address is the load-bearing
      // identifier for now.
      symbol: '?',
      decimals: 0,
      chainId: tx.chainId,
    }

    return {
      bridge: BRIDGE_NAME,
      srcChain: tx.chainId,
      dstChain,
      recipient,
      token,
      amount: inputAmount,
      messageId: depositId.toString(),
      timestamp: tx.timestamp,
      // Across typically fills within minutes; allow up to fillDeadline
      // (default ~6h) as the upper bound for fuzzy matchers downstream.
      expectedDelaySeconds: [60, 6 * 60 * 60],
    }
  }

  async findDestination(
    send: BridgeSend,
    ctx: AdapterContext,
  ): Promise<NormalizedTx | null> {
    if (!send.messageId) return null
    const dstSpoke = SPOKE_POOL[send.dstChain]
    if (!dstSpoke) return null

    const matchingLog = await ctx.providers.run(send.dstChain, async () => {
      const client = ctx.providers.client(send.dstChain)
      const head = await client.getBlockNumber()
      const lookback = DESTINATION_LOOKBACK_BLOCKS[send.dstChain] ?? 50_000n
      const fromBlock = head > lookback ? head - lookback : 0n

      const logs = await client.getLogs({
        address: dstSpoke,
        event: FILLED_RELAY_EVENT,
        args: {
          originChainId: BigInt(send.srcChain),
          depositId: BigInt(send.messageId!),
        },
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

export const acrossAdapter: BridgeAdapter = new AcrossAdapter()
