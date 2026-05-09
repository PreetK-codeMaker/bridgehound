import { acrossAdapter } from './across/index.js'
import { hopAdapter } from './hop/index.js'
import { stargateAdapter } from './stargate/index.js'
import type { BridgeAdapter } from './types.js'

// Stargate and Hop are wired but inactive until their addresses tables are
// filled in. Until then their `matches()` returns false on every chain, so
// the registry pays only the import cost and the trace flow short-circuits
// to `terminationReason: 'no_bridge'` for their contracts. See each
// adapter's addresses.ts for the canonical sources to verify against.

export const defaultBridges: readonly BridgeAdapter[] = [
  acrossAdapter,
  stargateAdapter,
  hopAdapter,
]
