import type { Address, Hash, Hex } from 'viem'

/** Chain ID as a number, e.g. 1 for Ethereum mainnet. */
export type ChainId = number

/** A token, identified by its contract address (or `null` for native ETH). */
export interface TokenInfo {
  /** ERC-20 contract address, or null for the chain's native token. */
  address: Address | null
  /** Symbol for display, e.g. "USDC". */
  symbol: string
  /** Decimals — 6 for USDC, 18 for ETH/most tokens. */
  decimals: number
  /** Chain this token is on. */
  chainId: ChainId
}

/** A normalized transaction record. */
export interface NormalizedTx {
  chainId: ChainId
  hash: Hash
  blockNumber: bigint
  timestamp: number
  from: Address
  to: Address | null
  value: bigint
  input: Hex
}

/** A bridge "send" — what was extracted from a source-chain transaction. */
export interface BridgeSend {
  /** Name of the bridge protocol, e.g. "across". */
  bridge: string
  /** Origin chain. */
  srcChain: ChainId
  /** Destination chain. */
  dstChain: ChainId
  /**
   * Recipient on the destination chain. Optional because some bridges
   * (Stargate's OFT, for one) hide the recipient inside the LayerZero message
   * payload rather than in the source-side event, so we can't fill it in
   * without an extra decode step. Consumers must guard against `undefined`.
   */
  recipient?: Address
  /** Token being bridged. */
  token: TokenInfo
  /** Amount in token's smallest unit (wei for ETH, etc.). */
  amount: bigint
  /**
   * Bridge-specific deterministic identifier (deposit ID, message GUID, etc.).
   * Present when the bridge protocol exposes one. Enables exact matching.
   */
  messageId?: string
  /**
   * The bridge contract on the source chain that emitted the send event. Set
   * when the bridge contract is per-token (Hop, Stargate OFT) and we can't
   * cheaply resolve the underlying ERC-20 from the event alone. Distinct from
   * `token.address` so downstream consumers don't confuse the bridge contract
   * with the actual token being transferred.
   */
  sourceContract?: Address
  /** Source-chain timestamp of the deposit, used to bound destination search. */
  timestamp: number
  /** Expected delivery delay range in seconds [min, max]. */
  expectedDelaySeconds: readonly [number, number]
}

/** Why a trace branch ended. */
export type TerminationReason =
  | 'max_depth'
  | 'no_bridge'
  | 'unmatched'
  | 'cex_deposit'
  | 'refund'
  | 'mixer'
  | 'error'

/** A node in the trace tree. */
export interface TraceNode {
  chain: ChainId
  txHash: Hash
  from: Address
  to: Address | null
  amount: bigint
  token: TokenInfo
  timestamp: number
  /** Set if this transaction was identified as a bridge send. */
  bridge?: {
    name: string
    messageId?: string
    sourceContract?: Address
  }
  /** Destination-chain transactions, when this was a bridge send. */
  children: TraceNode[]
  /** Set on leaf nodes only. */
  terminationReason?: TerminationReason
  /** Free-form details for the UI to surface. */
  notes?: string
}

/** Statistics about a completed trace. */
export interface TraceStats {
  hops: number
  chainsVisited: ChainId[]
  /** Branches that ended at the depth cap; user can re-run with --depth N. */
  hitDepthLimit: number
  /** Branches that ended without a match (unmatched, error, mixer, …). */
  unresolvedEnds: number
  bridgesUsed: string[]
}

/** Sentinel returned when a node's token can't yet be derived from the tx. */
export const UNKNOWN_TOKEN: Omit<TokenInfo, 'chainId'> = {
  address: null,
  symbol: '?',
  decimals: 0,
}

/** The result of a `trace()` call. */
export interface TraceResult {
  root: TraceNode
  stats: TraceStats
}

/** Input to `trace()`. */
export interface TraceInput {
  /** Provide either txHash or address, not both. */
  txHash?: Hash
  address?: Address
  startChain: ChainId
  /** Default 5. */
  maxDepth?: number
  /** Default 10. Caps fan-out per node. */
  maxBranches?: number
}
