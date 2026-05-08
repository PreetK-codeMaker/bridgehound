/**
 * Minimal SpokePool ABI fragments.
 *
 * VERIFY before implementing — pull the current event signatures from the
 * deployed SpokePool's verified ABI on Etherscan, or from the Across SDK.
 * Field names and types below are placeholders.
 */

export const V3_FUNDS_DEPOSITED_EVENT = {
  type: 'event',
  name: 'V3FundsDeposited',
  inputs: [
    // { name: 'inputToken', type: 'address', indexed: false },
    // { name: 'outputToken', type: 'address', indexed: false },
    // { name: 'inputAmount', type: 'uint256', indexed: false },
    // { name: 'outputAmount', type: 'uint256', indexed: false },
    // { name: 'destinationChainId', type: 'uint256', indexed: true },
    // { name: 'depositId', type: 'uint32', indexed: true },
    // { name: 'depositor', type: 'address', indexed: true },
    // { name: 'recipient', type: 'address', indexed: false },
    // ... etc
  ],
} as const

export const FILLED_V3_RELAY_EVENT = {
  type: 'event',
  name: 'FilledV3Relay',
  inputs: [
    // VERIFY against current Across SpokePool ABI.
  ],
} as const
