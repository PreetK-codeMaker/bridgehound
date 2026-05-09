import type { Address, Log } from 'viem'
import type { CacheAdapter } from '../cache/types.js'
import type { ProviderRegistry } from '../chains/providers.js'
import type { BridgeSend, ChainId, NormalizedTx } from '../types.js'

export interface AdapterContext {
  providers: ProviderRegistry
  cache: CacheAdapter
}

export interface BridgeAdapter {
  /** Unique name, e.g. "across". */
  readonly name: string

  /** Quick filter — does this contract belong to this bridge on this chain? */
  matches(chainId: ChainId, contract: Address): boolean

  /**
   * Decode a source-side transaction into a BridgeSend.
   * Returns null if the call isn't a bridge send (admin function, refund, …).
   * Adapters receive the raw viem.Log[] and own their own decoding so they
   * can use blockNumber/transactionIndex/logIndex when ordering matters.
   */
  parseSend(tx: NormalizedTx, logs: readonly Log[]): BridgeSend | null

  /**
   * Find the destination-chain transaction matching this send.
   * Returns null if not found within reasonable bounds.
   * Adapters MUST route any direct viem client call through
   * `ctx.providers.run(chainId, …)` to respect the per-chain semaphore.
   */
  findDestination(send: BridgeSend, ctx: AdapterContext): Promise<NormalizedTx | null>

  /**
   * Chains this adapter has at least one contract configured for. Used by
   * tooling (e.g. `bridgehound bridges`) to show which adapters are live
   * vs. wired-but-inactive. Empty array → adapter exists in the registry
   * but has no addresses populated yet.
   */
  supportedChains(): readonly ChainId[]
}
