/**
 * Stable exit codes per BSD sysexits.h conventions. Scripts piping JSON
 * output can branch on these without parsing stderr.
 */
export const EXIT = {
  /** User passed bad arguments (typo, out-of-range, malformed input). */
  USAGE: 64,
  /** Validated input was correct but referred to something we couldn't fetch. */
  NOT_FOUND: 69,
  /** Internal error: failed to decode a bridge log, ABI mismatch, etc. */
  INTERNAL: 70,
  /** RPC layer failed (rate limit, network error, malformed response). */
  RPC: 75,
} as const
export type ExitCode = (typeof EXIT)[keyof typeof EXIT]
