import type { Hash, Log } from 'viem'
import type { CacheAdapter } from '../cache/types.js'
import type { ChainId, NormalizedTx } from '../types.js'
import { RPCError } from '../utils/errors.js'
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
  const cached = await cache.get<NormalizedTx>(txKey(chainId, hash))
  if (cached) return cached

  return providers.withConcurrency(chainId, async () => {
    const client = providers.client(chainId)
    try {
      const tx = await client.getTransaction({ hash })
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

      await cache.set(txKey(chainId, hash), normalized, TX_TTL_SECONDS)
      return normalized
    } catch (err) {
      if (err instanceof RPCError) throw err
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
  const cached = await cache.get<readonly Log[]>(logsKey(chainId, hash))
  if (cached) return cached

  return providers.withConcurrency(chainId, async () => {
    const client = providers.client(chainId)
    try {
      const receipt = await client.getTransactionReceipt({ hash })
      if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase()) {
        throw new RPCError(`Receipt hash mismatch for ${hash}`)
      }
      const logs = receipt.logs
      await cache.set(logsKey(chainId, hash), logs, LOGS_TTL_SECONDS)
      return logs
    } catch (err) {
      if (err instanceof RPCError) throw err
      throw new RPCError(`Failed to fetch logs for ${hash} on chain ${chainId}`, err)
    }
  })
}
