import { describe, expect, it } from 'vitest'
import { parseRpcEntries, resolveProviders } from '../src/providers.js'
import { UsageError } from '../src/validate.js'

describe('parseRpcEntries', () => {
  it('parses a single entry', () => {
    expect(parseRpcEntries(['1=https://eth-rpc'], '--rpc')).toEqual({ 1: 'https://eth-rpc' })
  })

  it('parses multiple entries', () => {
    expect(parseRpcEntries(['1=https://a', '8453=https://b'], '--rpc')).toEqual({
      1: 'https://a',
      8453: 'https://b',
    })
  })

  it('skips empty entries (trailing comma case)', () => {
    expect(parseRpcEntries(['1=https://a', '', '   '], '--rpc')).toEqual({ 1: 'https://a' })
  })

  it('preserves URLs containing equals signs', () => {
    const url = 'https://example.com/?apikey=foo&extra=bar'
    expect(parseRpcEntries([`1=${url}`], '--rpc')).toEqual({ 1: url })
  })

  it('rejects entries without `=`', () => {
    expect(() => parseRpcEntries(['not_a_pair'], '--rpc')).toThrow(UsageError)
    expect(() => parseRpcEntries(['not_a_pair'], '--rpc')).toThrow(/must be "chainId=url"/)
  })

  it('rejects entries with empty url', () => {
    expect(() => parseRpcEntries(['1='], '--rpc')).toThrow(UsageError)
  })

  it('rejects entries with empty chainId', () => {
    expect(() => parseRpcEntries(['=https://x'], '--rpc')).toThrow(UsageError)
  })

  it('rejects non-integer chainId', () => {
    expect(() => parseRpcEntries(['abc=https://x'], '--rpc')).toThrow(/positive integer/)
  })

  it('rejects unsupported chainId with the supported list', () => {
    expect(() => parseRpcEntries(['999=https://x'], '--rpc')).toThrow(/not supported/)
    expect(() => parseRpcEntries(['999=https://x'], '--rpc')).toThrow(/1, 10, 137/)
  })

  it('uses the origin label in error messages', () => {
    expect(() => parseRpcEntries(['bad'], 'RPC_URLS')).toThrow(/RPC_URLS entry "bad"/)
  })
})

describe('resolveProviders', () => {
  it('falls back to public RPCs when no key and no overrides', () => {
    const { providers, source } = resolveProviders({
      cliOverrides: {},
      envOverrides: {},
      alchemyKey: undefined,
    })
    expect(source).toMatch(/^public/)
    expect(providers[1]).toMatch(/^https:\/\//)
    expect(providers[8453]).toMatch(/^https:\/\//)
  })

  it('uses Alchemy when key is set', () => {
    const { providers, source } = resolveProviders({
      cliOverrides: {},
      envOverrides: {},
      alchemyKey: 'abc',
    })
    expect(source).toBe('Alchemy')
    expect(providers[1]).toContain('alchemy.com')
    expect(providers[1]).toContain('abc')
  })

  it('cli overrides win over env overrides win over Alchemy', () => {
    const { providers, source } = resolveProviders({
      cliOverrides: { 1: 'https://from-cli' },
      envOverrides: { 1: 'https://from-env', 8453: 'https://from-env-base' },
      alchemyKey: 'k',
    })
    expect(providers[1]).toBe('https://from-cli')
    expect(providers[8453]).toBe('https://from-env-base')
    expect(providers[10]).toContain('alchemy.com')
    expect(source).toMatch(/Alchemy with \d+ override/)
  })

  it('reports public + override count when no key', () => {
    const { source } = resolveProviders({
      cliOverrides: { 1: 'https://x' },
      envOverrides: {},
      alchemyKey: undefined,
    })
    expect(source).toMatch(/^public \+ 1 override/)
  })
})
