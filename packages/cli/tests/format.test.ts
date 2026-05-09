import { describe, expect, it } from 'vitest'
import type { BridgeAdapter } from 'bridgehound'
import { formatBridges, formatChains } from '../src/format.js'

function makeBridge(name: string, chains: number[]): BridgeAdapter {
  return {
    name,
    matches: () => false,
    parseSend: () => null,
    findDestination: async () => null,
    supportedChains: () => chains,
  }
}

describe('formatBridges', () => {
  it('returns blank output for empty input without crashing', () => {
    expect(formatBridges([])).toBe('')
  })

  it('renders a single active bridge', () => {
    const out = formatBridges([makeBridge('across', [1, 10])])
    expect(out).toBe('across  active on 2 chain(s): 1, 10')
  })

  it('renders an inactive bridge', () => {
    const out = formatBridges([makeBridge('hop', [])])
    expect(out).toBe('hop  inactive (no contract addresses configured)')
  })

  it('aligns names across mixed active/inactive bridges', () => {
    const out = formatBridges([
      makeBridge('across', [1, 10]),
      makeBridge('hop', []),
      makeBridge('stargate', [1]),
    ])
    const lines = out.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('across    active on 2 chain(s): 1, 10')
    expect(lines[1]).toBe('hop       inactive (no contract addresses configured)')
    expect(lines[2]).toBe('stargate  active on 1 chain(s): 1')
  })
})

describe('formatChains', () => {
  it('returns blank output for empty input without crashing', () => {
    expect(formatChains({})).toBe('')
  })

  it('renders a single chain', () => {
    expect(formatChains({ 1: { name: 'Ethereum' } })).toBe('1  Ethereum')
  })

  it('aligns ids of varying width', () => {
    const out = formatChains({
      1: { name: 'Ethereum' },
      10: { name: 'Optimism' },
      8453: { name: 'Base' },
    })
    const lines = out.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('1     Ethereum')
    expect(lines[1]).toBe('10    Optimism')
    expect(lines[2]).toBe('8453  Base')
  })
})
