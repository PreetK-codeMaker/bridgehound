import type { Address } from 'viem'
import type { ChainId } from '../../types.js'

/**
 * Stargate v2 contracts to watch on each chain.
 *
 * Stargate v2 is built on LayerZero OFT. Unlike Across (one SpokePool per
 * chain), Stargate has one OFT/Pool contract per token per chain — so this
 * is a list, not a single address. Adapters check membership.
 *
 * Source: stargate.finance/docs (deployments page) and the official
 * stargate-v2 contracts repo. Verify each address against current docs
 * before relying on it.
 *
 * Filling this in is a separate task — the adapter is wired but inactive
 * until at least one chain has entries.
 */
export const STARGATE_OFTS: Record<ChainId, readonly Address[]> = {
  // 1: ['0x...', '0x...'],     // Ethereum: USDC OFT, USDT OFT, ETH OFT, …
  // 10: ['0x...', '0x...'],    // Optimism
  // 137: ['0x...', '0x...'],   // Polygon
  // 8453: ['0x...', '0x...'],  // Base
  // 42161: ['0x...', '0x...'], // Arbitrum
}

/**
 * LayerZero Endpoint ID → ChainId. Stargate's OFTSent event carries an
 * `dstEid` (LayerZero endpoint), not a chain ID. Convert it before
 * populating BridgeSend.dstChain.
 *
 * Source: docs.layerzero.network/v2/deployments/deployed-contracts
 * Verify before relying on these.
 */
export const EID_TO_CHAIN_ID: Record<number, ChainId> = {
  // 30101: 1,      // Ethereum
  // 30110: 42161,  // Arbitrum
  // 30111: 10,     // Optimism
  // 30184: 8453,   // Base
  // 30109: 137,    // Polygon
}

export function isStargateContract(chainId: ChainId, contract: Address): boolean {
  const list = STARGATE_OFTS[chainId]
  if (!list) return false
  const target = contract.toLowerCase()
  return list.some((a) => a.toLowerCase() === target)
}
