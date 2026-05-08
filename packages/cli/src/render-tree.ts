import type { TraceNode } from 'bridgehound'

const CHAIN_NAMES: Record<number, string> = {
  1: 'ethereum',
  10: 'optimism',
  137: 'polygon',
  8453: 'base',
  42161: 'arbitrum',
}

function chainLabel(id: number): string {
  return CHAIN_NAMES[id] ?? `chain-${id}`
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

function nodeLine(node: TraceNode): string {
  const parts = [`[${chainLabel(node.chain)}]`, shortHash(node.txHash)]
  if (node.bridge) {
    const id = node.bridge.messageId ? ` #${node.bridge.messageId}` : ''
    parts.push(`→ ${node.bridge.name}${id}`)
  }
  if (node.terminationReason) {
    parts.push(`(${node.terminationReason})`)
  }
  return parts.join(' ')
}

export function renderTree(root: TraceNode): void {
  const out = process.stdout
  const walk = (node: TraceNode, prefix: string, isLast: boolean, isRoot: boolean): void => {
    const branch = isRoot ? '' : isLast ? '└── ' : '├── '
    out.write(`${prefix}${branch}${nodeLine(node)}\n`)
    const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ')
    node.children.forEach((child, i) => {
      walk(child, childPrefix, i === node.children.length - 1, false)
    })
  }
  walk(root, '', true, true)
}
