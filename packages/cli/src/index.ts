#!/usr/bin/env node
import { cac } from 'cac'
import kleur from 'kleur'
import ora from 'ora'
import { defaultBridges, SUPPORTED_CHAINS, trace, type TraceStats } from 'bridgehound'
import { renderTree } from './render-tree.js'
import { EXIT } from './exit-codes.js'
import { formatBridges, formatChains } from './format.js'
import { friendlyError } from './friendly-error.js'
import { parseRpcEntries, resolveProviders } from './providers.js'
import { UsageError, validateChain, validateDepth, validateOutput, validateTxHash } from './validate.js'

const cli = cac('bridgehound')

cli
  .command('trace <txHash>', 'Trace a transaction across bridges')
  .option('--chain <id>', 'Source chain ID', { default: '1' })
  .option('--depth <n>', 'Maximum trace depth (1-50)', { default: '5' })
  .option('--output <format>', 'Output format: pretty | json', { default: 'pretty' })
  .option(
    '--rpc <chainId=url>',
    'Per-chain RPC override; repeat for multiple chains. Takes precedence over RPC_URLS env var.',
    { default: [] },
  )
  .option('--quiet', 'Suppress the "Using X RPCs." stderr line', { default: false })
  .example('  bridgehound trace 0xabc... --chain 1')
  .example('  bridgehound trace 0xabc... --chain 1 --rpc 1=https://my-eth-rpc')
  .example('  bridgehound trace 0xabc... --chain 1 --output json | jq .stats')
  .action(
    async (
      txHash: string,
      options: {
        chain: string
        depth: string
        output: string
        rpc: string | string[]
        quiet: boolean
      },
    ) => {
      try {
        const validatedHash = validateTxHash(txHash)
        const chain = validateChain(options.chain)
        const depth = validateDepth(options.depth)
        const output = validateOutput(options.output)

        const cliRpc = Array.isArray(options.rpc) ? options.rpc : [options.rpc]
        const cliOverrides = parseRpcEntries(cliRpc, '--rpc')
        const envOverrides = parseRpcEntries(
          (process.env.RPC_URLS ?? '').split(','),
          'RPC_URLS',
        )
        const { providers, source } = resolveProviders({
          cliOverrides,
          envOverrides,
          alchemyKey: process.env.ALCHEMY_API_KEY,
        })

        if (!options.quiet) {
          console.error(kleur.dim(`Using ${source} RPCs.`))
        }

        const spinner = output === 'json' ? null : ora('Tracing...').start()
        try {
          const result = await trace(
            { txHash: validatedHash, startChain: chain, maxDepth: depth },
            { providers },
          )
          spinner?.succeed('Trace complete')

          if (output === 'json') {
            process.stdout.write(JSON.stringify(result, bigintReplacer, 2) + '\n')
          } else {
            renderTree(result.root)
            printStats(result.stats, depth)
          }
        } catch (err) {
          spinner?.fail('Trace failed')
          throw err
        }
      } catch (err) {
        const friendly = err instanceof UsageError
          ? { message: err.message, exitCode: EXIT.USAGE }
          : friendlyError(err)
        console.error(kleur.red(friendly.message))
        process.exitCode = friendly.exitCode
        return
      }
    },
  )

cli
  .command('bridges', 'List supported bridge protocols and their status')
  .action(() => {
    console.log(formatBridges(defaultBridges))
  })

cli
  .command('chains', 'List supported chain IDs')
  .action(() => {
    console.log(formatChains(SUPPORTED_CHAINS))
  })

cli.help()
cli.version('0.0.1')
cli.parse()

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
