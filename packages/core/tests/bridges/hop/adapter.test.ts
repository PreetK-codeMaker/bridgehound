import { describe, expect, it } from 'vitest'
import type { NormalizedTx } from '../../../src/types.js'
import { hopAdapter } from '../../../src/bridges/hop/index.js'

const ETHEREUM = 1

const tx: NormalizedTx = {
  chainId: ETHEREUM,
  hash: '0xtx',
  blockNumber: 100n,
  timestamp: 1_700_000_000,
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: 0n,
  input: '0x',
}

describe('HopAdapter — inert until contracts populated', () => {
  it('exposes the bridge name', () => {
    expect(hopAdapter.name).toBe('hop')
  })

  it('matches() returns false on every chain because HOP_CONTRACTS is empty', () => {
    expect(hopAdapter.matches(ETHEREUM, tx.to!)).toBe(false)
    expect(hopAdapter.matches(42161, tx.to!)).toBe(false)
  })

  it('parseSend returns null for any tx while addresses are empty', () => {
    expect(hopAdapter.parseSend(tx, [])).toBeNull()
  })

  it('parseSend returns null when tx.to is null', () => {
    const creation: NormalizedTx = { ...tx, to: null }
    expect(hopAdapter.parseSend(creation, [])).toBeNull()
  })

  it('findDestination returns null when the destination chain has no Hop contracts', async () => {
    const result = await hopAdapter.findDestination(
      {
        bridge: 'hop',
        srcChain: ETHEREUM,
        dstChain: 42161,
        token: { address: null, symbol: '?', decimals: 0, chainId: ETHEREUM },
        amount: 1n,
        // 32-byte hex transferId
        messageId: `0x${'ab'.repeat(32)}`,
        timestamp: 1_700_000_000,
        expectedDelaySeconds: [60, 86_400],
      },
      // No providers/cache touched because the addresses-empty check fires first.
      // Cast through unknown to satisfy the AdapterContext shape without standing
      // up real fakes.
      { providers: {}, cache: {} } as never,
    )
    expect(result).toBeNull()
  })

  it('findDestination returns null for a non-hex messageId (guards against viem.getLogs throwing)', async () => {
    const result = await hopAdapter.findDestination(
      {
        bridge: 'hop',
        srcChain: ETHEREUM,
        dstChain: 42161,
        token: { address: null, symbol: '?', decimals: 0, chainId: ETHEREUM },
        amount: 1n,
        messageId: 'not-a-hex-string',
        timestamp: 1_700_000_000,
        expectedDelaySeconds: [60, 86_400],
      },
      { providers: {}, cache: {} } as never,
    )
    expect(result).toBeNull()
  })

  it('findDestination returns null for a hex messageId of the wrong length', async () => {
    const result = await hopAdapter.findDestination(
      {
        bridge: 'hop',
        srcChain: ETHEREUM,
        dstChain: 42161,
        token: { address: null, symbol: '?', decimals: 0, chainId: ETHEREUM },
        amount: 1n,
        messageId: '0xdeadbeef',
        timestamp: 1_700_000_000,
        expectedDelaySeconds: [60, 86_400],
      },
      { providers: {}, cache: {} } as never,
    )
    expect(result).toBeNull()
  })
})
