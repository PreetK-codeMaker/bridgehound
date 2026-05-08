/**
 * Cached values must be JSON-safe. NormalizedTx and viem.Log carry bigints
 * (blockNumber, value, transactionIndex, …), which JSON.stringify rejects.
 *
 * These helpers walk a value and tag bigints with a sentinel object so any
 * cache backend — in-memory or Redis — can serialize them uniformly.
 */

const BIGINT_TAG = '__bridgehound_bigint__'

interface TaggedBigInt {
  readonly [BIGINT_TAG]: string
}

function isTaggedBigInt(value: unknown): value is TaggedBigInt {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    BIGINT_TAG in value &&
    typeof (value as Record<string, unknown>)[BIGINT_TAG] === 'string'
  )
}

export function serializeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return { [BIGINT_TAG]: value.toString() }
  if (Array.isArray(value)) return value.map(serializeBigInts)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeBigInts(v)
    }
    return out
  }
  return value
}

export function deserializeBigInts(value: unknown): unknown {
  if (isTaggedBigInt(value)) return BigInt(value[BIGINT_TAG])
  if (Array.isArray(value)) return value.map(deserializeBigInts)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deserializeBigInts(v)
    }
    return out
  }
  return value
}
