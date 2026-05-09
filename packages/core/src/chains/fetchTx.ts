import type { Hash, Log } from 'viem'
import { deserializeBigInts, serializeBigInts } from '../cache/serialize.js'
import type { CacheAdapter } from '../cache/types.js'
import type { ChainId, NormalizedTx } from '../types.js'
import { InvalidInputError, RevertedTxError, RPCError } from '../utils/errors.js'
import type { ProviderRegistry } from './providers.js'

const TX_TTL_SECONDS = 60 * 60 * 24
const LOGS_TTL_SECONDS = 60 * 60 * 24

function txKey(chainId: ChainId, hash: Hash): string {
  return `tx:${chainId}:${hash.toLowerCase()}`
}

function logsKey(chainId: ChainId, hash: Hash): string {
  return `logs:${chainId}:${hash.toLowerCase()}`
}

export async function fetchTx(
  providers: ProviderRegistry,
  cache: CacheAdapter,
  chainId: ChainId,
  hash: Hash,
): Promise<NormalizedTx> {
  const cached = await cache.get<unknown>(txKey(chainId, hash))
  if (cached) return deserializeBigInts(cached) as NormalizedTx

  return providers.run(chainId, async () => {
    const client = providers.client(chainId)
    try {
      const tx = await client.getTransaction({ hash })
      if (tx.blockNumber === null) {
        throw new InvalidInputError(`Tx ${hash} on chain ${chainId} is pending; cannot trace`)
      }
      const block = await client.getBlock({ blockNumber: tx.blockNumber })

      const normalized: NormalizedTx = {
        chainId,
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        timestamp: Number(block.timestamp),
        from: tx.from,
        to: tx.to,
        value: tx.value,
        input: tx.input,
      }

      await cache.set(txKey(chainId, hash), serializeBigInts(normalized), TX_TTL_SECONDS)
      return normalized
    } catch (err) {
      if (err instanceof RPCError) throw err
      if (err instanceof InvalidInputError) throw err
      throw new RPCError(`Failed to fetch tx ${hash} on chain ${chainId}`, err)
    }
  })
}

export async function fetchLogs(
  providers: ProviderRegistry,
  cache: CacheAdapter,
  chainId: ChainId,
  hash: Hash,
): Promise<readonly Log[]> {
  const cached = await cache.get<unknown>(logsKey(chainId, hash))
  if (cached) return deserializeBigInts(cached) as readonly Log[]

  return providers.run(chainId, async () => {
    const client = providers.client(chainId)
    try {
      const receipt = await client.getTransactionReceipt({ hash })
      if (receipt.status === 'reverted') {
        throw new RevertedTxError(`Tx ${hash} on chain ${chainId} was reverted`)
      }
      const logs = receipt.logs
      await cache.set(logsKey(chainId, hash), serializeBigInts(logs), LOGS_TTL_SECONDS)
      return logs
    } catch (err) {
      if (err instanceof RPCError) throw err
      if (err instanceof RevertedTxError) throw err
      throw new RPCError(`Failed to fetch logs for ${hash} on chain ${chainId}`, err)
    }
  })
}
