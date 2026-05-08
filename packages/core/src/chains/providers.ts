import { createPublicClient, http, type PublicClient } from 'viem'
import type { ChainId } from '../types.js'
import { RPCError } from '../utils/errors.js'
import { getChain } from './index.js'

export interface ProviderConfig {
  /** Map of chainId → primary RPC URL. */
  primary: Record<ChainId, string>
  /** Optional fallback URLs, used on rate limit or 5xx. */
  fallback?: Record<ChainId, string>
  /** Max in-flight requests per chain. Defaults to 5. */
  concurrency?: number
}

export class ProviderRegistry {
  private clients = new Map<ChainId, PublicClient>()
  private semaphores = new Map<ChainId, Semaphore>()

  constructor(private readonly config: ProviderConfig) {}

  client(chainId: ChainId): PublicClient {
    const cached = this.clients.get(chainId)
    if (cached) return cached

    const url = this.config.primary[chainId]
    if (!url) {
      throw new RPCError(`No RPC configured for chain ${chainId}`)
    }

    const client = createPublicClient({
      chain: getChain(chainId),
      transport: http(url, {
        retryCount: 2,
        retryDelay: 250,
        timeout: 15_000,
      }),
    }) as PublicClient

    this.clients.set(chainId, client)
    return client
  }

  async withConcurrency<T>(chainId: ChainId, fn: () => Promise<T>): Promise<T> {
    let sem = this.semaphores.get(chainId)
    if (!sem) {
      sem = new Semaphore(this.config.concurrency ?? 5)
      this.semaphores.set(chainId, sem)
    }
    return sem.run(fn)
  }
}

class Semaphore {
  private active = 0
  private queue: Array<() => void> = []

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.active++
    try {
      return await fn()
    } finally {
      this.active--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}
