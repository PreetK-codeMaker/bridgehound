# bridgehound (core library)

The TypeScript library that powers the [bridgehound CLI](../cli/README.md). Use this directly if you want to embed cross-chain tracing in your own service or UI. See the [top-level README](../../README.md) for what bridgehound is and what problem it solves.

## Install

Not yet on npm. Use as a workspace dep, or import the built artifact directly.

## Quick example

```typescript
import { trace } from 'bridgehound'

const result = await trace(
  {
    txHash: '0x94d689c37f31836e0b322642dd8797eb69f6fa5ccffe7531762bdae00e2f3233',
    startChain: 1,
    maxDepth: 5,
  },
  {
    providers: {
      1: 'https://ethereum-rpc.publicnode.com',
      8453: 'https://mainnet.base.org',
      // Add the chains you need; missing ones fail at fetch time.
    },
  },
)

console.log(result.root.bridge?.name)         // "across"
console.log(result.stats.chainsVisited)       // [1, 8453]
for (const child of result.root.children) {
  console.log(child.chain, child.txHash)      // 8453, 0x2d5445d4…
}
```

## API surface

### `trace(input, config): Promise<TraceResult>`

The entry point. Walks from a source-side tx hash through every bridge it can recognize.

**`input`** — what to trace:

| Field | Type | Notes |
| --- | --- | --- |
| `txHash` | `0x${string}` | The source-chain tx hash (32-byte hex). |
| `startChain` | `number` | The chain ID `txHash` lives on. |
| `maxDepth` | `number?` | Optional. Default 5. Caps how many hops to follow. |

The `TraceInput` type union also accepts an `address` variant, but it is not yet implemented — passing one currently throws `InvalidInputError`. Only `txHash` input is supported today.

**`config`** — runtime configuration:

| Field | Type | Notes |
| --- | --- | --- |
| `providers` | `Partial<Record<ChainId, string>>` | RPC URL per chain. Add every chain the trace might cross. |
| `bridges` | `readonly BridgeAdapter[]?` | Optional. Defaults to `defaultBridges` (Across + scaffolds for Stargate/Hop). |
| `cache` | `CacheAdapter?` | Optional. Defaults to a fresh in-memory cache per call. |
| `concurrency` | `number?` | Optional. Per-chain in-flight RPC limit (default 5). |

**Returns** `TraceResult`:

```typescript
interface TraceResult {
  root: TraceNode    // the source tx, with .children populated per hop
  stats: TraceStats
}
```

`TraceStats` fields:

| Field | Meaning |
| --- | --- |
| `hops` | Number of bridge crossings detected. |
| `chainsVisited` | Distinct chain IDs touched. |
| `bridgesUsed` | Distinct bridge names. |
| `hitDepthLimit` | Count of nodes terminated by `max_depth`. |
| `unresolvedEnds` | Count of leaf nodes whose `terminationReason` is none of `no_bridge`, `refund`, or `max_depth` (`max_depth` is counted separately as `hitDepthLimit`) — i.e. trails that *could* have continued but didn't (e.g. `unmatched` or `error`). |

`TraceNode` is recursive — each child is itself a `TraceNode` with its own children. Leaves carry a `terminationReason` indicating *why* the trace stopped:

- `max_depth` — hit the configured cap; could go further with a higher `maxDepth`.
- `no_bridge` — the recipient didn't bridge again. Most traces end here.
- `unmatched` — the bridge was identified but no matching destination tx was found in the lookback window.
- `error` — RPC layer failed for this branch (e.g. source tx reverted).

The `TerminationReason` union also reserves `cex_deposit`, `refund`, and `mixer` for future heuristics; these are not currently emitted.

### `defaultBridges: readonly BridgeAdapter[]`

The list of adapters the CLI uses out of the box. Pass your own if you want to add a custom bridge or limit which protocols are considered.

```typescript
import { defaultBridges, trace } from 'bridgehound'
import { myBridgeAdapter } from './my-bridge.js'

await trace(input, {
  providers: { 1: '…' },
  bridges: [...defaultBridges, myBridgeAdapter],
})
```

### `SUPPORTED_CHAINS: Record<ChainId, Chain>` and `getChain(id)`

The set of chains the library knows about (re-exported viem chain objects). Use these to drive UI dropdowns or validate user input:

```typescript
import { SUPPORTED_CHAINS, getChain } from 'bridgehound'

for (const [id, chain] of Object.entries(SUPPORTED_CHAINS)) {
  console.log(id, chain.name)  // 1 Ethereum, 10 OP Mainnet, …
}

const eth = getChain(1)
```

`getChain(id)` throws on an unsupported ID. Currently 1, 10, 137, 8453, 42161.

### `MemoryCache`

The default `CacheAdapter` implementation. Stateless across `trace()` calls (a new one is constructed per call by default). Supply your own for cross-call caching:

```typescript
import { MemoryCache, trace } from 'bridgehound'

const cache = new MemoryCache()
await trace(input1, { providers, cache })
await trace(input2, { providers, cache })  // shares fetched txs / logs
```

### `BridgeAdapter`

The interface every bridge implements. Useful if you want to write your own adapter:

```typescript
interface BridgeAdapter {
  readonly name: string
  matches(chainId: ChainId, contract: Address): boolean
  parseSend(tx: NormalizedTx, logs: readonly Log[]): BridgeSend | null
  findDestination(send: BridgeSend, ctx: AdapterContext): Promise<NormalizedTx | null>
  supportedChains(): readonly ChainId[]
}
```

The `Across` adapter at [src/bridges/across/adapter.ts](./src/bridges/across/adapter.ts) is the reference implementation.

### `CacheAdapter`

The shape any cache needs:

```typescript
interface CacheAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
}
```

A `null` payload is indistinguishable from a miss, by design. Write a Redis or filesystem adapter against this interface to share state across processes.

## Errors

The library uses a small hierarchy:

| Class | When |
| --- | --- |
| `InvalidInputError` | Validation failure (`txHash` shape, missing required field). Surface to the user. |
| `UnknownChainError` | `getChain(id)` was called with a chain ID this build doesn't support. |
| `RPCError` | Network / transport failure talking to a chain. Includes the original viem error as `.cause`. |
| `RevertedTxError` | The source-side tx was reverted; nothing to trace. Surface, don't retry. |
| `BridgeDecodeError` | A bridge log couldn't be decoded — usually means the ABI in the adapter is out of date. |

All extend `BridgehoundError` for `instanceof` checks.

## Status

Pre-alpha. The Across adapter is fully wired; Stargate and Hop are scaffolded but inactive (no addresses configured). See the [top-level status table](../../README.md#status).

## License

MIT.
