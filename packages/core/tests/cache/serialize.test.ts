import { describe, expect, it } from 'vitest'
import { deserializeBigInts, serializeBigInts } from '../../src/cache/serialize.js'

describe('serializeBigInts / deserializeBigInts', () => {
  it('round-trips primitive bigints through JSON', () => {
    const input = 12345n
    const serialized = serializeBigInts(input)
    const json = JSON.parse(JSON.stringify(serialized)) as unknown
    expect(deserializeBigInts(json)).toBe(input)
  })

  it('round-trips nested structures with mixed types', () => {
    const input = {
      hash: '0xabc',
      blockNumber: 18_500_000n,
      logs: [
        { topic: '0x1', value: 0n },
        { topic: '0x2', value: 999_999_999_999_999_999_999n },
      ],
      meta: null,
      ok: true,
    }
    const serialized = serializeBigInts(input)
    const json = JSON.parse(JSON.stringify(serialized)) as unknown
    expect(deserializeBigInts(json)).toEqual(input)
  })

  it('leaves non-bigint primitives untouched', () => {
    for (const v of ['s', 1, true, null]) {
      expect(serializeBigInts(v)).toBe(v)
      expect(deserializeBigInts(v)).toBe(v)
    }
  })

  it('serializes 0n (an edge-case for falsy bigints)', () => {
    const out = JSON.parse(JSON.stringify(serializeBigInts(0n))) as unknown
    expect(deserializeBigInts(out)).toBe(0n)
  })

  it('serializes negative bigints', () => {
    const out = JSON.parse(JSON.stringify(serializeBigInts(-42n))) as unknown
    expect(deserializeBigInts(out)).toBe(-42n)
  })

  it('does not mistake a user object that happens to have a __bridgehound_bigint__ key for a tagged bigint when the value is non-string', () => {
    // The tagged-bigint detector requires the marker value to be a string;
    // a numeric value should be treated as plain object data, not decoded.
    const sneaky = { __bridgehound_bigint__: 42 }
    const out = deserializeBigInts(sneaky)
    expect(out).toEqual(sneaky)
  })
})
