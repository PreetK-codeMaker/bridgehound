import type { Address } from 'viem'
import type { ChainId } from '../../types.js'

/**
 * SpokePool proxy addresses per chain.
 * Source: https://docs.across.to/reference/contract-addresses (verified
 * against across-protocol/contracts deployments JSON, master branch).
 */
export const SPOKE_POOL: Record<ChainId, Address> = {
  1: '0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5',
  10: '0x6f26Bf09B1C792e3228e5467807a900A503c0281',
  137: '0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096',
  8453: '0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64',
  42161: '0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A',
}
