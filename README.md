# bridgehound

Trace funds across bridges. Give it a transaction hash and the chain it's on; it returns a tree showing every cross-chain hop the funds took.

## What it actually does

Crypto bridges let you move tokens between blockchains. They split a single transfer into two transactions: one on the source chain that locks/burns funds, one on the destination chain that mints/releases them. Block explorers don't connect those two — each chain only sees its own half.

`bridgehound` connects them. You point it at a source-side transaction; it identifies the bridge, finds the matching delivery transaction on the destination chain, and recurses if the recipient bridges further.

```
$ bridgehound trace 0x94d689c3…2f3233 --chain 1
[ethereum] 0x94d689c3…2f3233 → across #3894835
└── [base] 0x2d5445d4…341952 (no_bridge)

Summary
  hops: 1
  chains: 1, 8453
  bridges: across
  unresolved: 0
```

That trace says: someone sent funds on Ethereum through Across; they were delivered on Base; the recipient stopped there.

## Status

Pre-alpha. The plumbing works end-to-end; only one bridge is fully wired.

| Component | Status |
| --- | --- |
| Across adapter | Active on Ethereum, Optimism, Polygon, Base, Arbitrum |
| Stargate adapter | Wired but inactive — contract addresses + LayerZero EID map need verifying |
| Hop adapter | Wired but inactive — contract addresses need verifying |
| Fuzzy matching (no message ID) | Stub, intentional v0.1 omission |
| Aggregator-routed deposits (LI.FI, Socket, …) | Not yet — `tx.to` must be the bridge contract directly |
| Web app / hosted UI | Not started |
| Published to npm | Not yet |

Run `node packages/cli/dist/index.js bridges` to see live status from the build you have.

## Quick start

```bash
nvm use 20         # Node 20+ required
pnpm install
pnpm build

# Trace any Across deposit, no API key needed (uses public RPCs)
node packages/cli/dist/index.js trace 0xYOUR_TX --chain 1
```

`--chain 1` is Ethereum mainnet. Other supported chains: `10` Optimism, `137` Polygon, `8453` Base, `42161` Arbitrum.

To shorten `node packages/cli/dist/index.js …` to just `bridgehound …`, run `cd packages/cli && pnpm link --global` once after the build. See [packages/cli/README.md](./packages/cli/README.md) for all options.

For a faster trace, export `ALCHEMY_API_KEY` in your shell (or put it in `.env` and run `set -a && source .env && set +a` first — the CLI doesn't auto-load `.env`). It's picked up automatically.

## How it works (one paragraph)

Each bridge protocol has a deterministic identifier — Across uses a `depositId`, Stargate uses a LayerZero GUID, Hop uses a `transferId`. The source-chain transaction emits an event containing this ID; the destination-chain transaction emits a matching event with the same ID. `bridgehound` decodes the source event, queries the destination chain's bridge contract for the matching event, fetches that transaction, and repeats. Adapters per bridge encapsulate the protocol-specific decoding; the orchestrator handles RPC calls, caching, and tree assembly.

## Project structure

```
packages/
├── core/    — the bridgehound library (no CLI deps)
│   ├── src/bridges/     adapter for each protocol
│   ├── src/chains/      RPC client wrapper, per-chain semaphore
│   ├── src/cache/       in-memory cache with bigint-safe serialization
│   └── src/trace.ts     orchestrator
└── cli/     — the bridgehound command-line tool
    ├── src/index.ts     subcommands: trace, bridges, chains
    ├── src/providers.ts RPC selection (public / Alchemy / RPC_URLS / --rpc)
    └── src/friendly-error.ts  classifies failures, maps to exit codes
```

## Add a new bridge

In short:

1. `packages/core/src/bridges/<name>/` — create `addresses.ts`, `abi.ts`, `adapter.ts`, `index.ts`. Mirror the structure of `bridges/across/`.
2. Implement the `BridgeAdapter` interface (`name`, `matches`, `parseSend`, `findDestination`, `supportedChains`).
3. Add the adapter to `packages/core/src/bridges/registry.ts`.
4. Write a fixture-driven test in `packages/core/tests/bridges/<name>/`.

The Across adapter ([packages/core/src/bridges/across/adapter.ts](./packages/core/src/bridges/across/adapter.ts)) is the reference implementation.

## License

MIT.
