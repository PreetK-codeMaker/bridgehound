import { SUPPORTED_CHAINS } from 'bridgehound'
import { UsageError } from './validate.js'

export const PUBLIC_RPCS: Record<number, string> = {
  1: 'https://ethereum-rpc.publicnode.com',
  10: 'https://optimism-rpc.publicnode.com',
  137: 'https://polygon-bor-rpc.publicnode.com',
  8453: 'https://mainnet.base.org',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
}

export function alchemyProviders(key: string): Record<number, string> {
  return {
    1: `https://eth-mainnet.g.alchemy.com/v2/${key}`,
    10: `https://opt-mainnet.g.alchemy.com/v2/${key}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${key}`,
    8453: `https://base-mainnet.g.alchemy.com/v2/${key}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${key}`,
  }
}

/**
 * Parse a list of `chainId=url` entries (from `--rpc` flag or `RPC_URLS`
 * env var). Empty entries (trailing commas, blank `--rpc`) are skipped.
 * The chainId/url split is on the first `=` only so URLs with query
 * strings like `?apikey=foo` survive intact.
 */
export function parseRpcEntries(entries: readonly string[], origin: string): Record<number, string> {
  const out: Record<number, string> = {}
  for (const entry of entries) {
    if (!entry.trim()) continue
    const eq = entry.indexOf('=')
    if (eq < 0) {
      throw new UsageError(`${origin} entry "${entry}" must be "chainId=url"`)
    }
    const chainId = entry.slice(0, eq).trim()
    const url = entry.slice(eq + 1).trim()
    if (!chainId || !url) {
      throw new UsageError(`${origin} entry "${entry}" must be "chainId=url"`)
    }
    if (!/^\d+$/.test(chainId)) {
      throw new UsageError(`${origin} chainId "${chainId}" must be a positive integer`)
    }
    const id = Number(chainId)
    if (!Number.isInteger(id) || id <= 0) {
      throw new UsageError(`${origin} chainId "${chainId}" must be a positive integer`)
    }
    if (!SUPPORTED_CHAINS[id]) {
      const supported = Object.keys(SUPPORTED_CHAINS).join(', ')
      throw new UsageError(`${origin} chainId ${id} is not supported (supported: ${supported})`)
    }
    out[id] = url
  }
  return out
}

/**
 * Resolve providers per chain. Precedence (highest first):
 *   1. CLI `--rpc` flags (passed as `cliOverrides`)
 *   2. `RPC_URLS` env var (parsed and passed as `envOverrides`)
 *   3. Alchemy URLs (when `ALCHEMY_API_KEY` is set)
 *   4. Public RPC fallback
 */
export function resolveProviders(args: {
  cliOverrides: Record<number, string>
  envOverrides: Record<number, string>
  alchemyKey: string | undefined
}): { providers: Record<number, string>; source: string } {
  const base = args.alchemyKey ? alchemyProviders(args.alchemyKey) : PUBLIC_RPCS
  const providers = { ...base, ...args.envOverrides, ...args.cliOverrides }

  const overrideCount = Object.keys({ ...args.envOverrides, ...args.cliOverrides }).length
  let source: string
  if (overrideCount > 0 && args.alchemyKey) {
    source = `Alchemy with ${overrideCount} override(s)`
  } else if (overrideCount > 0) {
    source = `public + ${overrideCount} override(s)`
  } else if (args.alchemyKey) {
    source = 'Alchemy'
  } else {
    source = 'public (rate-limited; set ALCHEMY_API_KEY, RPC_URLS, or --rpc for better limits)'
  }
  return { providers, source }
}
