import type { ChainId } from '../types.js'

/**
 * Per-chain lookback window for destination-side log scans. L2 lookback
 * windows are intentionally broad to cover slow bridge paths.
 */
export const DESTINATION_LOOKBACK_BLOCKS: Partial<Record<ChainId, bigint>> = {
  1: 50_000n, // ~7 days at 12s blocks
  10: 5_000_000n, // ~116 days at 2s blocks (Optimism)
  137: 2_000_000n, // ~51 days at 2.2s blocks (Polygon)
  8453: 5_000_000n, // ~116 days at 2s blocks (Base)
  42161: 20_000_000n, // ~58 days at 0.25s blocks (Arbitrum)
}

/**
 * Maximum block range per `eth_getLogs` request. Public RPCs cap ranges at
 * 2k–10k blocks; chunk scans into windows of this size and walk newest →
 * oldest, returning on the first match.
 */
export const LOG_SCAN_CHUNK = 10_000n

/**
 * Approximate block production rate per chain. Used to bound destination-side
 * log scans by the source-side `send.timestamp` so we don't walk further back
 * than the bridge could have possibly delivered.
 */
export const BLOCKS_PER_SECOND: Partial<Record<ChainId, number>> = {
  1: 1 / 12, // Ethereum: ~12s blocks
  10: 1 / 2, // Optimism: ~2s blocks
  137: 1 / 2.2, // Polygon: ~2.2s blocks
  8453: 1 / 2, // Base: ~2s blocks
  42161: 4, // Arbitrum: ~0.25s blocks
}
