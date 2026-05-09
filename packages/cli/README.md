# bridgehound CLI

Command-line tool for tracing funds across bridges. See the [top-level README](../../README.md) for what `bridgehound` is and what problem it solves.

## Install

This package isn't on npm yet. From a clone:

```bash
nvm use 20    # Node 20+ required
pnpm install
pnpm build

# Run via the built artifact
node packages/cli/dist/index.js <command> [args]

# Or link globally so you can run `bridgehound …` directly
cd packages/cli && pnpm link --global
```

Once linked, every example below works as `bridgehound …` instead of the longer `node packages/cli/dist/index.js …`.

## Commands

### `trace <txHash>`

Follow a source-side transaction across bridges and print the resulting tree.

```bash
bridgehound trace 0xYOUR_TX --chain 1
```

**Options:**

| Flag | Default | Meaning |
| --- | --- | --- |
| `--chain <id>` | `1` | Source chain ID. See `bridgehound chains` for the list. |
| `--depth <n>` | `5` | Maximum number of hops to follow (1–50). |
| `--output <fmt>` | `pretty` | `pretty` for the tree, `json` for raw JSON. |
| `--rpc <chainId=url>` | (none; repeatable) | Per-chain RPC override. Wins over env vars. |
| `--quiet` | `false` | Suppress the `Using X RPCs.` stderr line (useful when piping JSON). |

**Examples:**

```bash
# Public RPCs, free, slower
bridgehound trace 0xabc... --chain 1

# Use a specific RPC just for Base, public/Alchemy for the rest
bridgehound trace 0xabc... --chain 1 --rpc 8453=https://my-base-rpc

# Override two chains
bridgehound trace 0xabc... --chain 1 --rpc 1=https://eth1 --rpc 8453=https://base1

# JSON for scripting
bridgehound trace 0xabc... --chain 1 --quiet --output json | jq .stats

# Deeper trace (e.g. funds bridge twice)
bridgehound trace 0xabc... --chain 1 --depth 10
```

### `bridges`

List supported bridge protocols and which chains each is currently active on.

```bash
$ bridgehound bridges
across    active on 5 chain(s): 1, 10, 137, 8453, 42161
stargate  inactive (no contract addresses configured)
hop       inactive (no contract addresses configured)
```

"Inactive" means the adapter is registered but its contract address table is empty — those bridges won't ever be detected until someone fills them in. See the [top-level status table](../../README.md#status) for which bridges are live.

### `chains`

List supported chain IDs and their human names.

```bash
$ bridgehound chains
1      Ethereum
10     OP Mainnet
137    Polygon
8453   Base
42161  Arbitrum One
```

## RPC configuration

The CLI doesn't require any signup. By default it falls back to free public RPCs. Configure better RPC access using one or more of these, in priority order (highest first):

1. **`--rpc <chainId=url>`** flag(s) on the command line — wins per chain.
2. **`RPC_URLS`** env var, comma-separated `chainId=url` — wins per chain.
3. **`ALCHEMY_API_KEY`** env var — used for any chain not overridden above. One key, all five chains.
4. **Public RPCs** (PublicNode for Ethereum/Optimism/Polygon/Arbitrum, mainnet.base.org for Base) — used if none of the above.

These can be mixed. For example, `ALCHEMY_API_KEY=…` plus `--rpc 8453=https://my-base-rpc` runs Base on your URL and the rest on Alchemy.

URLs may contain query strings (`?apikey=…`); the parser splits on the first `=` only. Trailing commas in `RPC_URLS` are silently ignored.

### Why public RPCs sometimes fail

Public Ethereum nodes vary in retention and may not have a tx that's a few hours old. If you see `tx-not-found` on a tx you know exists, switch the source chain's RPC:

```bash
RPC_URLS=1=https://ethereum-rpc.publicnode.com bridgehound trace 0xabc... --chain 1
```

Public Base RPCs sometimes time out on the destination-side log scan. Coinbase's own `https://mainnet.base.org` handles 10k-block ranges fine and is the CLI's default for Base.

### Why Alchemy free tier sometimes fails

Alchemy's free tier caps `eth_getLogs` at 10 blocks. The destination-side scan uses 10k-block chunks. If you hit this, override just the destination chain to a public RPC:

```bash
ALCHEMY_API_KEY=… bridgehound trace 0xabc... --chain 1 --rpc 8453=https://mainnet.base.org
```

The CLI prints a hint when this happens.

## Exit codes

The CLI follows BSD `sysexits.h` conventions so scripts can branch on them:

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `64` | Usage error (bad arguments) |
| `69` | Not found (tx doesn't exist on the RPC, source tx was reverted) |
| `70` | Internal error (e.g. failed to decode a bridge log; ABI may be stale) |
| `75` | RPC error (rate limit, timeout, transport failure) |

## JSON output schema

`--output json` prints the full result tree:

```json
{
  "root": {
    "chain": 1,
    "txHash": "0x…",
    "from": "0x…",
    "to": "0x…",
    "amount": "1000000",
    "token": { "address": "0x…", "chainId": 1 },
    "timestamp": 1778314079,
    "bridge": { "name": "across", "messageId": "3894835", "sourceContract": "0x…" },
    "children": [
      { "chain": 8453, "txHash": "0x…", "...": "..." }
    ]
  },
  "stats": {
    "hops": 1,
    "chainsVisited": [1, 8453],
    "hitDepthLimit": 0,
    "unresolvedEnds": 0,
    "bridgesUsed": ["across"]
  }
}
```

`amount` is a decimal string (bigint not natively JSON-encodable). `terminationReason` (when set) takes one of: `max_depth`, `no_bridge`, `unmatched`, `error`. `sourceContract` is optional — present when the bridge contract that emitted the source-side event is distinct from the token address. `messageId` is set when the bridge protocol exposes a deterministic identifier; absent for fuzzy-matched bridges. The `cex_deposit`, `refund`, and `mixer` values are reserved for future heuristics and not currently emitted.

## Library mode

Anything the CLI does, you can do programmatically by calling the `trace()` function from the [`bridgehound`](../core/README.md) library.
