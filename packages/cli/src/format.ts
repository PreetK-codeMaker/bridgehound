import type { BridgeAdapter } from 'bridgehound'

export function formatBridges(bridges: readonly BridgeAdapter[]): string {
  const rows = bridges.map((b) => {
    const chains = b.supportedChains()
    const status = chains.length > 0
      ? `active on ${chains.length} chain(s): ${chains.join(', ')}`
      : 'inactive (no contract addresses configured)'
    return { name: b.name, status }
  })
  const nameWidth = Math.max(0, ...rows.map((r) => r.name.length))
  return rows.map((row) => `${row.name.padEnd(nameWidth)}  ${row.status}`).join('\n')
}

export function formatChains(chains: Record<number, { name: string }>): string {
  const entries = Object.entries(chains)
  const idWidth = Math.max(0, ...entries.map(([id]) => id.length))
  return entries.map(([id, chain]) => `${id.padEnd(idWidth)}  ${chain.name}`).join('\n')
}
