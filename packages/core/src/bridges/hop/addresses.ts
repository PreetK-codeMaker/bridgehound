import type { Address } from 'viem'
import type { ChainId } from '../../types.js'

/**
 * Hop bridge contracts to watch.
 *
 * Hop has a per-token contract on each chain — `L1Bridge` on Ethereum and
 * `L2AmmWrapper`/`L2Bridge` on each L2. So like Stargate, this is a list
 * per chain rather than a single address.
 *
 * Source: docs.hop.exchange (deployments) and the hop-protocol/contracts
 * repo. Verify each address against current docs before relying on it.
 *
 * Empty-by-default — adapter is wired but inactive until populated.
 */
export const HOP_CONTRACTS: Record<ChainId, readonly Address[]> = {
  // 1: ['0x...', '0x...'],     // Ethereum: L1Bridge per token (USDC, USDT, ETH, …)
  // 10: ['0x...', '0x...'],    // Optimism: L2_AmmWrapper / L2Bridge per token
  // 137: ['0x...', '0x...'],   // Polygon
  // 8453: ['0x...', '0x...'],  // Base
  // 42161: ['0x...', '0x...'], // Arbitrum
}

export function isHopContract(chainId: ChainId, contract: Address): boolean {
  const list = HOP_CONTRACTS[chainId]
  if (!list) return false
  const target = contract.toLowerCase()
  return list.some((a) => a.toLowerCase() === target)
}
