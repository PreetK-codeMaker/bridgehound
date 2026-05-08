import type { BridgeAdapter } from './types.js'

// Each adapter file exports a singleton instance.
// Filled in as adapters are implemented.
// import { acrossAdapter } from './across/index.js'
// import { stargateAdapter } from './stargate/index.js'
// import { hopAdapter } from './hop/index.js'

export const defaultBridges: readonly BridgeAdapter[] = [
  // acrossAdapter,
  // stargateAdapter,
  // hopAdapter,
]
