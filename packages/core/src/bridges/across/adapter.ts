import type { Address, Log } from 'viem'
import type { AdapterContext, BridgeAdapter } from '../types.js'
import type { BridgeSend, ChainId, NormalizedTx } from '../../types.js'
import { SPOKE_POOL } from './addresses.js'

class AcrossAdapter implements BridgeAdapter {
  readonly name = 'across'

  matches(chainId: ChainId, contract: Address): boolean {
    const expected = SPOKE_POOL[chainId]
    if (!expected) return false
    return contract.toLowerCase() === expected.toLowerCase()
  }

  parseSend(_tx: NormalizedTx, _logs: readonly Log[]): BridgeSend | null {
    // TODO: locate V3FundsDeposited log, decode it, build BridgeSend.
    // Returning null until the SpokePool ABI is verified — orchestrator will
    // then surface terminationReason: 'no_bridge' instead of crashing.
    return null
  }

  async findDestination(
    _send: BridgeSend,
    _ctx: AdapterContext,
  ): Promise<NormalizedTx | null> {
    // TODO: query FilledV3Relay events on the destination SpokePool,
    // filtered by originChainId == send.srcChain and depositId == send.messageId.
    return null
  }
}

export const acrossAdapter: BridgeAdapter = new AcrossAdapter()
