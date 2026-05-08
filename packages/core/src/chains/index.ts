import { arbitrum, base, mainnet, optimism, polygon, type Chain } from 'viem/chains'
import type { ChainId } from '../types.js'
import { UnknownChainError } from '../utils/errors.js'

export const SUPPORTED_CHAINS: Record<ChainId, Chain> = {
  1: mainnet,
  10: optimism,
  137: polygon,
  8453: base,
  42161: arbitrum,
}

export function getChain(id: ChainId): Chain {
  const chain = SUPPORTED_CHAINS[id]
  if (!chain) throw new UnknownChainError(`Unsupported chain: ${id}`)
  return chain
}
