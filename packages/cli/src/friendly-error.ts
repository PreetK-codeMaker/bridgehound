import { EXIT, type ExitCode } from './exit-codes.js'

export interface FriendlyError {
  message: string
  exitCode: ExitCode
}

/** Walk the `cause` chain and return every message we can find. */
function collectMessages(err: unknown): { joined: string; parts: string[] } {
  const seen = new Set<unknown>()
  const parts: string[] = []
  let current: unknown = err
  while (current && !seen.has(current)) {
    seen.add(current)
    if (current instanceof Error) {
      parts.push(current.message)
      current = (current as { cause?: unknown }).cause
    } else {
      parts.push(String(current))
      break
    }
  }
  return { joined: parts.join(' | '), parts }
}

/**
 * Map a thrown error to a (message, exitCode) pair the CLI prints + exits
 * with. Anything not specifically classified falls through as a generic
 * RPC error with the underlying message attached so the user can still see
 * the raw failure.
 */
export function friendlyError(err: unknown): FriendlyError {
  // Search the full cause chain — library wrappers like RPCError nest the
  // original viem error inside .cause, so the diagnostic substrings we
  // care about (rate limit, tx-not-found, timeout) often live there.
  const { joined: haystack, parts } = collectMessages(err)
  // For wrapped errors, surface the full chain so the inner cause text
  // doesn't get lost. For a single error, just use its own message.
  const raw = parts.length > 1 ? haystack : (err instanceof Error ? err.message : String(err))

  const name = err instanceof Error ? err.name : ''

  if (name === 'InvalidInputError') {
    return { message: raw, exitCode: EXIT.USAGE }
  }
  if (name === 'RevertedTxError') {
    return {
      message: `${raw}\n  → The source transaction was reverted on-chain; there is nothing to trace.`,
      exitCode: EXIT.NOT_FOUND,
    }
  }
  if (name === 'BridgeDecodeError') {
    return {
      message: `${raw}\n  → A bridge log could not be decoded. The ABI may be out of date — check addresses.ts and abi.ts.`,
      exitCode: EXIT.INTERNAL,
    }
  }

  // viem's TransactionNotFoundError shows up here as a generic Error with a
  // distinctive message; map it to the not-found exit code.
  if (/Transaction with hash .* could not be found/.test(haystack)) {
    return {
      message:
        `${raw}\n  → The RPC node doesn't have this transaction. Try a different provider, or check the chain ID.`,
      exitCode: EXIT.NOT_FOUND,
    }
  }

  // Common Alchemy free-tier limit message.
  if (/rate.?limit|too many requests|429|free tier|quota/i.test(haystack)) {
    return {
      message:
        `${raw}\n  → RPC limit hit. Try setting RPC_URLS / --rpc to a different provider, or upgrade your plan.`,
      exitCode: EXIT.RPC,
    }
  }

  // viem timeout
  if (/took too long|TimeoutError/i.test(haystack)) {
    return {
      message:
        `${raw}\n  → The RPC didn't respond in time. Try a different provider.`,
      exitCode: EXIT.RPC,
    }
  }

  // Default: assume RPC layer.
  return { message: raw, exitCode: EXIT.RPC }
}
