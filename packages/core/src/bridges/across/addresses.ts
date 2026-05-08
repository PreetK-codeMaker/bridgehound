import type { Address } from 'viem'
import type { ChainId } from '../../types.js'

/**
 * SpokePool contract address per chain.
 *
 * VERIFY before publishing — Across rotates these on protocol upgrades.
 * Source of truth: https://docs.across.to (deployments page).
 */
export const SPOKE_POOL: Record<ChainId, Address> = {
  // 1: '0x...',     // Ethereum
  // 10: '0x...',    // Optimism
  // 137: '0x...',   // Polygon
  // 8453: '0x...',  // Base
  // 42161: '0x...', // Arbitrum
}
