import { describe, expect, it } from 'vitest'
import { bytes32ToAddress } from '../../../src/bridges/across/codec.js'

describe('bytes32ToAddress', () => {
  it('extracts the lower 20 bytes of a left-padded EVM address', () => {
    const padded = '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd'
    // viem checksums the recovered address; assert on the lowercase form so
    // the test isn't pinned to a specific checksum-mix layout.
    expect(bytes32ToAddress(padded as `0x${string}`).toLowerCase()).toBe(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    )
  })

  it('rejects values whose upper 12 bytes are non-zero (non-EVM identifiers)', () => {
    // High byte set — looks like a Solana pubkey, not an EVM address.
    const sol = '0x1100000000000000000000001111111111111111111111111111111111111111'
    expect(() => bytes32ToAddress(sol as `0x${string}`)).toThrow(/not an EVM address/)
  })

  it('rejects values that are not 32 bytes', () => {
    expect(() => bytes32ToAddress('0xabcd' as `0x${string}`)).toThrow(/Expected 32-byte hex/)
  })

  it('handles the all-zero edge case (the zero address)', () => {
    const zero = `0x${'0'.repeat(64)}` as `0x${string}`
    expect(bytes32ToAddress(zero)).toBe('0x0000000000000000000000000000000000000000')
  })
})
