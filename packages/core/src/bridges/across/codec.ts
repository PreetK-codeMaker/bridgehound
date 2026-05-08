import type { Address, Hex } from 'viem'
import { getAddress } from 'viem'

/**
 * Across encodes EVM addresses as bytes32 (left-padded with 12 zero bytes) so
 * the same field can carry Solana / other-VM identifiers in the future.
 * For EVM source/destination chains, recover the 20-byte address.
 *
 * Throws if the upper 12 bytes are non-zero — that means the value isn't an
 * EVM address (e.g. a Solana pubkey) and the caller shouldn't be treating it
 * like one.
 */
export function bytes32ToAddress(value: Hex): Address {
  if (value.length !== 66) {
    throw new Error(`Expected 32-byte hex (0x + 64 chars), got ${value.length - 2} chars`)
  }
  // Upper 12 bytes (24 hex chars after 0x) must all be zero.
  const upper = value.slice(2, 26)
  if (!/^0+$/.test(upper)) {
    throw new Error(`bytes32 ${value} is not an EVM address (non-zero upper bytes)`)
  }
  return getAddress(`0x${value.slice(26)}` as Hex)
}
