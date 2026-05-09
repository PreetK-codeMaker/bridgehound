import type { ChainId } from '../types.js'

/**
 * Per-chain lookback window for destination-side log scans. Coverage varies by
 * chain: Ethereum's RPC limits keep us at ~7 days, while the L2s reach ~50–60
 * days at their faster block rates. That's plenty for any bridge whose
 * deliveries land in minutes.
 */
export const DESTINATION_LOOKBACK_BLOCKS: Record<ChainId, bigint> = {
  1: 50_000n, // ~7 days at 12s blocks
  10: 5_000_000n, // ~58 days at 1s blocks (Optimism)
  137: 2_000_000n, // ~52 days at 2.2s blocks
  8453: 5_000_000n, // ~58 days at 1s blocks
  42161: 20_000_000n, // ~58 days at 0.25s blocks
}
