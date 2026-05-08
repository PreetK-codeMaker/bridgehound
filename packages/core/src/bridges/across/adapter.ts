import type { Address } from 'viem'
import type { AdapterContext, BridgeAdapter, DecodedLog } from '../types.js'
import type { BridgeSend, ChainId, NormalizedTx } from '../../types.js'
import { SPOKE_POOL } from './addresses.js'

class AcrossAdapter implements BridgeAdapter {
  readonly name = 'across'

  matches(chainId: ChainId, contract: Address): boolean {
    const expected = SPOKE_POOL[chainId]
    if (!expected) return false
    return contract.toLowerCase() === expected.toLowerCase()
  }

  parseSend(_tx: NormalizedTx, _logs: readonly DecodedLog[]): BridgeSend | null {
    // TODO: locate V3FundsDeposited log, decode it, build BridgeSend.
    // Fields to populate: dstChain, recipient, token, amount, messageId (= depositId).
    // Return null if no deposit log is found (admin call, refund, etc.).
    throw new Error('AcrossAdapter.parseSend not implemented')
  }

  async findDestination(
    _send: BridgeSend,
    _ctx: AdapterContext,
  ): Promise<NormalizedTx | null> {
    // TODO: query FilledV3Relay events on the destination SpokePool,
    // filtered by originChainId == send.srcChain and depositId == send.messageId.
    // Fetch the containing tx and return it. Null if not found.
    throw new Error('AcrossAdapter.findDestination not implemented')
  }
}

export const acrossAdapter: BridgeAdapter = new AcrossAdapter()
