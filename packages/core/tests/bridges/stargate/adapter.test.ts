import { describe, expect, it } from 'vitest'
import type { NormalizedTx } from '../../../src/types.js'
import { stargateAdapter } from '../../../src/bridges/stargate/index.js'

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

describe('StargateAdapter — inert until contracts populated', () => {
  it('exposes the bridge name', () => {
    expect(stargateAdapter.name).toBe('stargate')
  })

  it('matches() returns false on every chain because STARGATE_OFTS is empty', () => {
    // The scaffold lands with no addresses; matches should never identify a
    // tx as Stargate until someone fills the table. If this test starts
    // failing, the addresses table was populated — update the test rather
    // than the adapter.
    expect(stargateAdapter.matches(ETHEREUM, tx.to!)).toBe(false)
    expect(stargateAdapter.matches(42161, tx.to!)).toBe(false)
  })

  it('parseSend returns null for any tx while addresses are empty', () => {
    expect(stargateAdapter.parseSend(tx, [])).toBeNull()
  })

  it('parseSend returns null when tx.to is null (contract creation)', () => {
    const creation: NormalizedTx = { ...tx, to: null }
    expect(stargateAdapter.parseSend(creation, [])).toBeNull()
  })
})
