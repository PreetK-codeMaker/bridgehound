import { describe, expect, it } from 'vitest'
import { friendlyError } from '../src/friendly-error.js'
import { EXIT } from '../src/exit-codes.js'

class NamedError extends Error {
  constructor(name: string, message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined)
    this.name = name
  }
}

describe('friendlyError', () => {
  it('maps InvalidInputError to EXIT.USAGE', () => {
    const out = friendlyError(new NamedError('InvalidInputError', 'bad arg'))
    expect(out.exitCode).toBe(EXIT.USAGE)
    expect(out.message).toBe('bad arg')
  })

  it('maps RevertedTxError to EXIT.NOT_FOUND with explanatory hint', () => {
    const out = friendlyError(new NamedError('RevertedTxError', 'Tx reverted'))
    expect(out.exitCode).toBe(EXIT.NOT_FOUND)
    expect(out.message).toMatch(/reverted on-chain/)
  })

  it('maps BridgeDecodeError to EXIT.INTERNAL with ABI hint', () => {
    const out = friendlyError(new NamedError('BridgeDecodeError', 'decode failed'))
    expect(out.exitCode).toBe(EXIT.INTERNAL)
    expect(out.message).toMatch(/ABI may be out of date/)
  })

  it('detects viem TransactionNotFoundError nested in cause chain', () => {
    const inner = new Error('Transaction with hash "0xabc" could not be found.')
    const wrapper = new Error('Failed to fetch tx 0xabc on chain 1', { cause: inner })
    const out = friendlyError(wrapper)
    expect(out.exitCode).toBe(EXIT.NOT_FOUND)
    expect(out.message).toMatch(/different provider/)
  })

  it('detects rate-limit messages anywhere in the cause chain', () => {
    const inner = new Error('Free tier plan limit')
    const wrapper = new Error('Failed to fetch logs', { cause: inner })
    expect(friendlyError(wrapper).exitCode).toBe(EXIT.RPC)
    expect(friendlyError(wrapper).message).toMatch(/different provider/)
  })

  it('detects timeout messages', () => {
    const inner = new NamedError('TimeoutError', 'The request took too long to respond.')
    const wrapper = new Error('wrapped', { cause: inner })
    expect(friendlyError(wrapper).exitCode).toBe(EXIT.RPC)
    expect(friendlyError(wrapper).message).toMatch(/didn't respond in time/)
  })

  it('falls back to EXIT.RPC for unclassified errors', () => {
    const out = friendlyError(new Error('weird transport hiccup'))
    expect(out.exitCode).toBe(EXIT.RPC)
    expect(out.message).toBe('weird transport hiccup')
  })

  it('handles a non-Error throwable', () => {
    const out = friendlyError('plain string')
    expect(out.exitCode).toBe(EXIT.RPC)
    expect(out.message).toBe('plain string')
  })

  it('does not infinite-loop on a self-referential cause', () => {
    const e: Error & { cause?: unknown } = new Error('self')
    e.cause = e
    expect(() => friendlyError(e)).not.toThrow()
  })
})
