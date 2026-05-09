#!/usr/bin/env node
import { cac } from 'cac'
import kleur from 'kleur'
import ora from 'ora'
import { trace, type TraceStats } from 'bridgehound'
import { renderTree } from './render-tree.js'

// Public RPC fallbacks. Free, no key, rate-limited. Declared before
// cli.parse() so the action body — which can fire synchronously inside
// parse() — doesn't trip the const TDZ.
const PUBLIC_RPCS: Record<number, string> = {
  1: 'https://ethereum-rpc.publicnode.com',
  10: 'https://optimism-rpc.publicnode.com',
  137: 'https://polygon-bor-rpc.publicnode.com',
  8453: 'https://mainnet.base.org',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
}

const cli = cac('bridgehound')

cli
  .command('trace <txHash>', 'Trace a transaction across bridges')
  .option('--chain <id>', 'Source chain ID', { default: '1' })
  .option('--depth <n>', 'Maximum trace depth', { default: '5' })
  .option('--output <format>', 'Output format: pretty | json', { default: 'pretty' })
  .action(
    async (
      txHash: string,
      options: { chain: string; depth: string; output: string },
    ) => {
      const chain = parsePositiveInt(options.chain, '--chain')
      const depth = parsePositiveInt(options.depth, '--depth')
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        console.error(kleur.red(`Invalid tx hash: ${txHash}`))
        process.exitCode = 1
        return
      }

      let providers: Record<number, string>
      let source: string
      try {
        ;({ providers, source } = getProviders())
      } catch (err) {
        console.error(kleur.red(err instanceof Error ? err.message : String(err)))
        process.exitCode = 1
        return
      }
      console.error(kleur.dim(`Using ${source} RPCs.`))

      const spinner = ora('Tracing...').start()
      try {
        const result = await trace(
          {
            txHash: txHash as `0x${string}`,
            startChain: chain,
            maxDepth: depth,
          },
          { providers },
        )
        spinner.succeed('Trace complete')

        if (options.output === 'json') {
          process.stdout.write(JSON.stringify(result, bigintReplacer, 2) + '\n')
        } else {
          renderTree(result.root)
          printStats(result.stats, depth)
        }
      } catch (err) {
        spinner.fail('Trace failed')
        console.error(kleur.red(err instanceof Error ? err.message : String(err)))
        process.exitCode = 1
      }
    },
  )

cli.help()
cli.version('0.0.1')
cli.parse()

function parsePositiveInt(raw: string, flag: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    console.error(kleur.red(`${flag} must be a positive integer (got "${raw}")`))
    process.exit(1)
  }
  return n
}

function alchemyProviders(key: string): Record<number, string> {
  return {
    1: `https://eth-mainnet.g.alchemy.com/v2/${key}`,
    10: `https://opt-mainnet.g.alchemy.com/v2/${key}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${key}`,
    8453: `https://base-mainnet.g.alchemy.com/v2/${key}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${key}`,
  }
}

/**
 * Parse RPC_URLS env var: "chainId=url,chainId=url". Returns per-chain
 * overrides that take precedence over Alchemy and public defaults.
 */
function parseRpcUrls(raw: string | undefined): Record<number, string> {
  if (!raw) return {}
  const out: Record<number, string> = {}
  for (const entry of raw.split(',')) {
    if (!entry.trim()) continue
    const eq = entry.indexOf('=')
    if (eq < 0) {
      throw new Error(`RPC_URLS entry "${entry}" must be "chainId=url"`)
    }
    const chainId = entry.slice(0, eq).trim()
    const url = entry.slice(eq + 1).trim()
    if (!chainId || !url) {
      throw new Error(`RPC_URLS entry "${entry}" must be "chainId=url"`)
    }
    const id = Number(chainId)
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`RPC_URLS chainId "${chainId}" must be a positive integer`)
    }
    out[id] = url
  }
  return out
}

/**
 * Resolve RPCs per chain. Precedence: RPC_URLS overrides → Alchemy (if key)
 * → public fallback. Chains can be mixed: `RPC_URLS=1=quicknode-url` plus
 * `ALCHEMY_API_KEY=…` uses QuickNode for chain 1 and Alchemy for the rest.
 */
function getProviders(): { providers: Record<number, string>; source: string } {
  const overrides = parseRpcUrls(process.env.RPC_URLS)
  const key = process.env.ALCHEMY_API_KEY
  const base = key ? alchemyProviders(key) : PUBLIC_RPCS
  const providers = { ...base, ...overrides }

  const overrideCount = Object.keys(overrides).length
  let source: string
  if (overrideCount > 0 && key) {
    source = `Alchemy with ${overrideCount} RPC_URLS override(s)`
  } else if (overrideCount > 0) {
    source = `public + ${overrideCount} RPC_URLS override(s)`
  } else if (key) {
    source = 'Alchemy'
  } else {
    source = 'public (rate-limited; set ALCHEMY_API_KEY or RPC_URLS for better limits)'
  }
  return { providers, source }
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

function printStats(stats: TraceStats, maxDepth: number): void {
  console.log()
  console.log(kleur.bold('Summary'))
  console.log(`  hops: ${stats.hops}`)
  console.log(`  chains: ${stats.chainsVisited.join(', ')}`)
  console.log(`  bridges: ${stats.bridgesUsed.join(', ') || '(none)'}`)
  console.log(`  unresolved: ${stats.unresolvedEnds}`)
  if (stats.hitDepthLimit > 0) {
    console.log(
      kleur.yellow(
        `  hit depth limit: ${stats.hitDepthLimit} (re-run with --depth ${maxDepth + 5} to extend)`,
      ),
    )
  }
}
