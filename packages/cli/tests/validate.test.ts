import { describe, expect, it } from 'vitest'
import {
  UsageError,
  validateChain,
  validateDepth,
  validateOutput,
  validateTxHash,
} from '../src/validate.js'

describe('validateTxHash', () => {
  it('accepts a well-formed 0x + 64-hex string', () => {
    const h = `0x${'a'.repeat(64)}`
    expect(validateTxHash(h)).toBe(h)
  })

  it('accepts mixed case', () => {
    const h = `0x${'AbC012'.padEnd(64, '0')}`
    expect(validateTxHash(h)).toBe(h)
  })

  it('rejects missing 0x prefix', () => {
    expect(() => validateTxHash('a'.repeat(64))).toThrow(UsageError)
    expect(() => validateTxHash('a'.repeat(64))).toThrow(/Must start with "0x"/)
  })

  it('rejects wrong length', () => {
    expect(() => validateTxHash('0xabcd')).toThrow(/64 hex characters; got 4/)
    expect(() => validateTxHash(`0x${'a'.repeat(63)}`)).toThrow(/got 63/)
  })

  it('rejects non-hex characters after 0x', () => {
    expect(() => validateTxHash(`0x${'g'.repeat(64)}`)).toThrow(/non-hex characters/)
  })
})

describe('validateChain', () => {
  it('accepts a supported chain id as string', () => {
    expect(validateChain('1')).toBe(1)
    expect(validateChain('8453')).toBe(8453)
  })

  it('rejects non-integer', () => {
    expect(() => validateChain('1.5')).toThrow(/positive integer/)
    expect(() => validateChain('abc')).toThrow(/positive integer/)
  })

  it('rejects unsupported chain with helpful list', () => {
    expect(() => validateChain('999')).toThrow(/not supported/)
    expect(() => validateChain('999')).toThrow(/Ethereum/)
  })
})

describe('validateDepth', () => {
  it('accepts 1 through 50', () => {
    expect(validateDepth('1')).toBe(1)
    expect(validateDepth('50')).toBe(50)
  })

  it('rejects 0 and negative', () => {
    expect(() => validateDepth('0')).toThrow(/positive integer/)
    expect(() => validateDepth('-1')).toThrow(/positive integer/)
  })

  it('rejects > 50', () => {
    expect(() => validateDepth('51')).toThrow(/≤ 50/)
  })
})

describe('validateOutput', () => {
  it('accepts pretty and json', () => {
    expect(validateOutput('pretty')).toBe('pretty')
    expect(validateOutput('json')).toBe('json')
  })

  it('rejects anything else', () => {
    expect(() => validateOutput('xml')).toThrow(UsageError)
  })
})
