import { SUPPORTED_CHAINS } from 'bridgehound'

export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export function validateTxHash(raw: string): `0x${string}` {
  if (!raw.startsWith('0x')) {
    throw new UsageError(
      `Invalid tx hash: "${raw}"\n  → Must start with "0x"; got "${raw.slice(0, 4)}"`,
    )
  }
  const hex = raw.slice(2)
  if (hex.length !== 64) {
    throw new UsageError(
      `Invalid tx hash: "${raw}"\n  → Expected 0x followed by 64 hex characters; got ${hex.length}`,
    )
  }
  if (!/^[a-fA-F0-9]+$/.test(hex)) {
    throw new UsageError(
      `Invalid tx hash: "${raw}"\n  → Contains non-hex characters after the "0x" prefix`,
    )
  }
  return raw as `0x${string}`
}

export function validateChain(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new UsageError(`--chain must be a positive integer (got "${raw}")`)
  }
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new UsageError(`--chain must be a positive integer (got "${raw}")`)
  }
  if (!SUPPORTED_CHAINS[n]) {
    const supported = Object.entries(SUPPORTED_CHAINS)
      .map(([id, c]) => `${id} (${c.name})`)
      .join(', ')
    throw new UsageError(
      `--chain ${n} is not supported\n  → Supported chains: ${supported}`,
    )
  }
  return n
}

export function validateDepth(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new UsageError(`--depth must be a positive integer (got "${raw}")`)
  }
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new UsageError(`--depth must be a positive integer (got "${raw}")`)
  }
  if (n > 50) {
    throw new UsageError(`--depth must be ≤ 50 to bound RPC fan-out (got ${n})`)
  }
  return n
}

export function validateOutput(raw: string): 'pretty' | 'json' {
  if (raw === 'pretty' || raw === 'json') return raw
  throw new UsageError(`--output must be "pretty" or "json" (got "${raw}")`)
}
