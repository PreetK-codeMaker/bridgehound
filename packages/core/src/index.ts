export const VERSION = '0.0.1'

export { trace, type TraceConfig } from './trace.js'
export { defaultBridges } from './bridges/registry.js'
export { SUPPORTED_CHAINS, getChain } from './chains/index.js'
export { MemoryCache } from './cache/memory.js'
export type {
  BridgeSend,
  ChainId,
  TerminationReason,
  TokenInfo,
  TraceInput,
  TraceNode,
  TraceResult,
  TraceStats,
} from './types.js'
export type { BridgeAdapter } from './bridges/types.js'
export type { CacheAdapter } from './cache/types.js'
export {
  BridgehoundError,
  BridgeDecodeError,
  InvalidInputError,
  RevertedTxError,
  RPCError,
  UnknownChainError,
} from './utils/errors.js'
