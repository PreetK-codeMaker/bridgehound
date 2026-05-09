import { createPublicClient, http, type PublicClient } from 'viem'
import type { ChainId } from '../types.js'
import { RPCError } from '../utils/errors.js'
import { getChain } from './index.js'

export interface ProviderConfig {
  /** Map of chainId → primary RPC URL. */
  primary: Partial<Record<ChainId, string>>
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

    const client: PublicClient = createPublicClient({
      chain: getChain(chainId),
      transport: http(url, {
        retryCount: 2,
        retryDelay: 250,
        timeout: 15_000,
      }),
    })

    this.clients.set(chainId, client)
    return client
  }

  /**
   * Route an RPC operation through the per-chain semaphore.
   * Adapters should wrap any direct viem client call (`getLogs`, `getBlock`, …)
   * in this so a single chain's rate limit doesn't bring down the rest.
   */
  async run<T>(chainId: ChainId, fn: () => Promise<T>): Promise<T> {
    let sem = this.semaphores.get(chainId)
    if (!sem) {
      sem = new Semaphore(this.config.concurrency ?? 5)
      this.semaphores.set(chainId, sem)
    }
    return sem.run(fn)
  }
}

class Semaphore {
  private slots: number
  private queue: Array<() => void> = []

  constructor(limit: number) {
    this.slots = limit
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.slots > 0) {
      this.slots--
    } else {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    try {
      return await fn()
    } finally {
      const next = this.queue.shift()
      if (next) {
        next()
      } else {
        this.slots++
      }
    }
  }
}
