import type { Log } from 'viem'
import { defaultBridges } from './bridges/registry.js'
import type { AdapterContext, BridgeAdapter, DecodedLog } from './bridges/types.js'
import type { CacheAdapter } from './cache/types.js'
import { MemoryCache } from './cache/memory.js'
import { fetchLogs, fetchTx } from './chains/fetchTx.js'
import { ProviderRegistry } from './chains/providers.js'
import type {
  ChainId,
  NormalizedTx,
  TraceInput,
  TraceNode,
  TraceResult,
  TraceStats,
} from './types.js'
import { InvalidInputError } from './utils/errors.js'

export interface TraceConfig {
  providers: Record<ChainId, string>
  fallbackProviders?: Record<ChainId, string>
  bridges?: readonly BridgeAdapter[]
  cache?: CacheAdapter
  concurrency?: number
}

export async function trace(input: TraceInput, config: TraceConfig): Promise<TraceResult> {
  validateInput(input)

  const providers = new ProviderRegistry({
    primary: config.providers,
    ...(config.fallbackProviders ? { fallback: config.fallbackProviders } : {}),
    ...(config.concurrency !== undefined ? { concurrency: config.concurrency } : {}),
  })
  const cache = config.cache ?? new MemoryCache()
  const bridges = config.bridges ?? defaultBridges
  const ctx: AdapterContext = { providers, cache }

  const maxDepth = input.maxDepth ?? 5

  let root: TraceNode
  if (input.txHash) {
    const tx = await fetchTx(providers, cache, input.startChain, input.txHash)
    root = await traceFrom(tx, 0, maxDepth, bridges, ctx)
  } else if (input.address) {
    // Address-as-input is deferred — see open questions in ARCHITECTURE.md.
    throw new Error('address-as-input is not yet implemented')
  } else {
    throw new InvalidInputError('Must provide either txHash or address')
  }

  return { root, stats: computeStats(root) }
}

async function traceFrom(
  tx: NormalizedTx,
  depth: number,
  maxDepth: number,
  bridges: readonly BridgeAdapter[],
  ctx: AdapterContext,
): Promise<TraceNode> {
  const baseNode: TraceNode = {
    chain: tx.chainId,
    txHash: tx.hash,
    from: tx.from,
    to: tx.to,
    amount: tx.value,
    // Placeholder. Adapters that decode logs should overwrite via the BridgeSend.
    token: { address: null, symbol: 'ETH', decimals: 18, chainId: tx.chainId },
    timestamp: tx.timestamp,
    children: [],
  }

  if (depth >= maxDepth) {
    return { ...baseNode, terminationReason: 'max_depth' }
  }

  if (!tx.to) {
    return { ...baseNode, terminationReason: 'no_bridge' }
  }

  const adapter = bridges.find((b) => b.matches(tx.chainId, tx.to!))
  if (!adapter) {
    return { ...baseNode, terminationReason: 'no_bridge' }
  }

  const rawLogs = await fetchLogs(ctx.providers, ctx.cache, tx.chainId, tx.hash)
  const logs = rawLogs.map(toDecodedLog)

  const send = adapter.parseSend(tx, logs)
  if (!send) {
    return { ...baseNode, terminationReason: 'no_bridge' }
  }

  const node: TraceNode = {
    ...baseNode,
    token: send.token,
    amount: send.amount,
    bridge: { name: adapter.name, ...(send.messageId ? { messageId: send.messageId } : {}) },
  }

  const destTx = await adapter.findDestination(send, ctx)
  if (!destTx) {
    return { ...node, terminationReason: 'unmatched' }
  }

  const child = await traceFrom(destTx, depth + 1, maxDepth, bridges, ctx)
  return { ...node, children: [child] }
}

function toDecodedLog(log: Log): DecodedLog {
  return {
    address: log.address,
    topics: log.topics,
    data: log.data,
  }
}

function validateInput(input: TraceInput): void {
  if (!input.txHash && !input.address) {
    throw new InvalidInputError('Must provide either txHash or address')
  }
  if (input.txHash && input.address) {
    throw new InvalidInputError('Provide either txHash or address, not both')
  }
  if (typeof input.startChain !== 'number') {
    throw new InvalidInputError('startChain is required')
  }
}

function computeStats(root: TraceNode): TraceStats {
  const chainsVisited = new Set<ChainId>()
  const bridgesUsed = new Set<string>()
  let hops = 0
  let unresolvedEnds = 0

  const walk = (node: TraceNode): void => {
    chainsVisited.add(node.chain)
    if (node.bridge) {
      bridgesUsed.add(node.bridge.name)
      hops++
    }
    if (
      node.terminationReason &&
      node.terminationReason !== 'no_bridge' &&
      node.terminationReason !== 'refund'
    ) {
      unresolvedEnds++
    }
    for (const child of node.children) walk(child)
  }
  walk(root)

  return {
    hops,
    chainsVisited: [...chainsVisited],
    unresolvedEnds,
    bridgesUsed: [...bridgesUsed],
  }
}
