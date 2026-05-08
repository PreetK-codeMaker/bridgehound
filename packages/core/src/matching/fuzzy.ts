import type { AdapterContext } from '../bridges/types.js'
import type { BridgeSend, NormalizedTx } from '../types.js'

export interface FuzzyMatchOptions {
  /** Slippage tolerance as a fraction. Default 0.005 = 0.5%. */
  slippage?: number
}

/**
 * Fallback matcher used when a bridge does not expose a deterministic message ID.
 *
 * Strategy (planned):
 *   1. Compute the expected delivery window
 *      [send.timestamp + min, send.timestamp + max].
 *   2. Query the destination chain for transfers of `send.token`
 *      arriving at `send.recipient` within that window.
 *      ERC-20: filter Transfer(from, to, amount) events with to == recipient.
 *      Native ETH: scan blocks in the window for txs with value > 0 to recipient.
 *   3. Filter to transfers whose amount sits within the slippage band:
 *      |transferAmount - send.amount| / send.amount <= slippage
 *   4. If multiple match, prefer the smallest amount delta.
 *   5. Return the tx, or null when nothing fits.
 *
 * Pragmatic call for v0.1: deterministic matching covers Across/Stargate/Hop,
 * so this stays unimplemented until a bridge actually requires it.
 */
export async function findDestinationFuzzy(
  _send: BridgeSend,
  _ctx: AdapterContext,
  _options: FuzzyMatchOptions = {},
): Promise<NormalizedTx | null> {
  throw new Error('fuzzy matching not implemented (v0.1 deterministic-only)')
}
