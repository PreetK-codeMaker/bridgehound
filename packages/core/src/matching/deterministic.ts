import type { AdapterContext, BridgeAdapter } from '../bridges/types.js'
import type { BridgeSend, NormalizedTx } from '../types.js'

export async function findDestinationDeterministic(
  send: BridgeSend,
  adapter: BridgeAdapter,
  ctx: AdapterContext,
): Promise<NormalizedTx | null> {
  if (!send.messageId) return null
  return adapter.findDestination(send, ctx)
}
