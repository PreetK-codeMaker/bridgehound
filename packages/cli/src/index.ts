#!/usr/bin/env node
import { cac } from 'cac'
import kleur from 'kleur'
import ora from 'ora'
import { trace, type TraceStats } from 'bridgehound'
import { renderTree } from './render-tree.js'

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

      const spinner = ora('Tracing...').start()
      try {
        const result = await trace(
          {
            txHash: txHash as `0x${string}`,
            startChain: chain,
            maxDepth: depth,
          },
          {
            providers: getAlchemyProviders(),
          },
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

function getAlchemyProviders(): Record<number, string> {
  const key = process.env.ALCHEMY_API_KEY
  if (!key) {
    throw new Error('ALCHEMY_API_KEY environment variable is required')
  }
  return {
    1: `https://eth-mainnet.g.alchemy.com/v2/${key}`,
    10: `https://opt-mainnet.g.alchemy.com/v2/${key}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${key}`,
    8453: `https://base-mainnet.g.alchemy.com/v2/${key}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${key}`,
  }
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
