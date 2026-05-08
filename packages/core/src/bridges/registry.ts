import { acrossAdapter } from './across/index.js'
import type { BridgeAdapter } from './types.js'

// Stargate and Hop adapters land in follow-ups.
// import { stargateAdapter } from './stargate/index.js'
// import { hopAdapter } from './hop/index.js'

export const defaultBridges: readonly BridgeAdapter[] = [
  acrossAdapter,
  // stargateAdapter,
  // hopAdapter,
]
