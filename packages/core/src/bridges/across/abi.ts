/**
 * SpokePool event ABI fragments.
 * Source: across-protocol/contracts master branch
 * (deployments/mainnet/Ethereum_SpokePool.json).
 *
 * Note: Across migrated tokens/recipients/depositors to bytes32 to support
 * non-EVM destinations (Solana). For EVM addresses, the actual 20-byte address
 * sits in the last 20 bytes of the bytes32 (left-padded with zero bytes). Use
 * `bytes32ToAddress` from ./codec.ts to convert.
 *
 * Older contracts emit the legacy `V3FundsDeposited` event (uint256 depositId,
 * address fields). Decoding those is a follow-up — flagged in adapter.ts.
 */

export const FUNDS_DEPOSITED_EVENT = {
  type: 'event',
  name: 'FundsDeposited',
  anonymous: false,
  inputs: [
    { name: 'inputToken', type: 'bytes32', indexed: false },
    { name: 'outputToken', type: 'bytes32', indexed: false },
    { name: 'inputAmount', type: 'uint256', indexed: false },
    { name: 'outputAmount', type: 'uint256', indexed: false },
    { name: 'destinationChainId', type: 'uint256', indexed: true },
    { name: 'depositId', type: 'uint256', indexed: true },
    { name: 'quoteTimestamp', type: 'uint32', indexed: false },
    { name: 'fillDeadline', type: 'uint32', indexed: false },
    { name: 'exclusivityDeadline', type: 'uint32', indexed: false },
    { name: 'depositor', type: 'bytes32', indexed: true },
    { name: 'recipient', type: 'bytes32', indexed: false },
    { name: 'exclusiveRelayer', type: 'bytes32', indexed: false },
    { name: 'message', type: 'bytes', indexed: false },
  ],
} as const

export const FILLED_RELAY_EVENT = {
  type: 'event',
  name: 'FilledRelay',
  anonymous: false,
  inputs: [
    { name: 'inputToken', type: 'bytes32', indexed: false },
    { name: 'outputToken', type: 'bytes32', indexed: false },
    { name: 'inputAmount', type: 'uint256', indexed: false },
    { name: 'outputAmount', type: 'uint256', indexed: false },
    { name: 'repaymentChainId', type: 'uint256', indexed: false },
    { name: 'originChainId', type: 'uint256', indexed: true },
    { name: 'depositId', type: 'uint256', indexed: true },
    { name: 'fillDeadline', type: 'uint32', indexed: false },
    { name: 'exclusivityDeadline', type: 'uint32', indexed: false },
    { name: 'exclusiveRelayer', type: 'bytes32', indexed: false },
    { name: 'relayer', type: 'bytes32', indexed: true },
    { name: 'depositor', type: 'bytes32', indexed: false },
    { name: 'recipient', type: 'bytes32', indexed: false },
    { name: 'messageHash', type: 'bytes32', indexed: false },
    {
      name: 'relayExecutionInfo',
      type: 'tuple',
      indexed: false,
      components: [
        { name: 'updatedRecipient', type: 'bytes32' },
        { name: 'updatedMessageHash', type: 'bytes32' },
        { name: 'updatedOutputAmount', type: 'uint256' },
        { name: 'fillType', type: 'uint8' },
      ],
    },
  ],
} as const

export const SPOKE_POOL_ABI = [FUNDS_DEPOSITED_EVENT, FILLED_RELAY_EVENT] as const
