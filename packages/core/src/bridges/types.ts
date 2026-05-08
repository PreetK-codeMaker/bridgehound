import type { Address, Hash, Hex } from 'viem'
import type { CacheAdapter } from '../cache/types.js'
import type { ProviderRegistry } from '../chains/providers.js'
import type { BridgeSend, ChainId, NormalizedTx } from '../types.js'

export interface AdapterContext {
  providers: ProviderRegistry
  cache: CacheAdapter
}

export interface DecodedLog {
  address: Address
  topics: readonly Hash[]
  data: Hex
  /** Convenience: pre-decoded args if the caller recognized the event. */
  decoded?: {
    eventName: string
    args: Record<string, unknown>
  }
}

export interface BridgeAdapter {
  /** Unique name, e.g. "across". */
  readonly name: string

  /** Quick filter — does this contract belong to this bridge on this chain? */
  matches(chainId: ChainId, contract: Address): boolean

  /**
   * Decode a source-side transaction into a BridgeSend.
   * Returns null if the call isn't a bridge send (e.g. an admin function).
   */
  parseSend(tx: NormalizedTx, logs: readonly DecodedLog[]): BridgeSend | null

  /**
   * Find the destination-chain transaction matching this send.
   * Returns null if not found within reasonable bounds.
   */
  findDestination(send: BridgeSend, ctx: AdapterContext): Promise<NormalizedTx | null>
}
