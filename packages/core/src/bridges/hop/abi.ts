/**
 * Hop bridge event ABI fragments.
 *
 * Hop's L1↔L2 and L2↔L1/L2↔L2 paths emit different events:
 *
 *   - L1 → L2 sends emit `TransferSentToL2` on the L1Bridge.
 *   - L2 → L1 / L2 → L2 sends emit `TransferSent` on the L2Bridge.
 *   - The destination side emits `WithdrawalBonded` (when a bonder fronts
 *     the funds) or `Withdrew` (final settlement after the challenge period).
 *
 * The deterministic identifier is `transferId` — a keccak256 hash of the
 * source-side transfer parameters. The L2-side path includes it as an
 * indexed topic. The L1-side path doesn't emit transferId directly but
 * does emit the components needed to reconstruct it; for v0.1 this adapter
 * starts with the L2 path and falls back to fuzzy matching on L1 sends.
 *
 * VERIFY: hop-protocol/contracts master branch:
 *   - L1Bridge.sol → `TransferSentToL2(uint256 indexed chainId, address indexed recipient, uint256 amount, uint256 amountOutMin, uint256 deadline, address indexed relayer, uint256 relayerFee)`
 *   - L2Bridge.sol → `TransferSent(bytes32 indexed transferId, uint256 indexed chainId, address indexed recipient, uint256 amount, bytes32 transferNonce, uint256 bonderFee, uint256 amountOutMin, uint256 deadline, uint256 index)`
 *   - L2Bridge.sol → `WithdrawalBonded(bytes32 indexed transferId, uint256 amount)`
 *
 * Re-check signatures against current contracts before relying on them.
 */

export const TRANSFER_SENT_EVENT = {
  type: 'event',
  name: 'TransferSent',
  anonymous: false,
  inputs: [
    { name: 'transferId', type: 'bytes32', indexed: true },
    { name: 'chainId', type: 'uint256', indexed: true },
    { name: 'recipient', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'transferNonce', type: 'bytes32', indexed: false },
    { name: 'bonderFee', type: 'uint256', indexed: false },
    { name: 'amountOutMin', type: 'uint256', indexed: false },
    { name: 'deadline', type: 'uint256', indexed: false },
    { name: 'index', type: 'uint256', indexed: false },
  ],
} as const

export const TRANSFER_SENT_TO_L2_EVENT = {
  type: 'event',
  name: 'TransferSentToL2',
  anonymous: false,
  inputs: [
    { name: 'chainId', type: 'uint256', indexed: true },
    { name: 'recipient', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'amountOutMin', type: 'uint256', indexed: false },
    { name: 'deadline', type: 'uint256', indexed: false },
    { name: 'relayer', type: 'address', indexed: true },
    { name: 'relayerFee', type: 'uint256', indexed: false },
  ],
} as const

export const WITHDRAWAL_BONDED_EVENT = {
  type: 'event',
  name: 'WithdrawalBonded',
  anonymous: false,
  inputs: [
    { name: 'transferId', type: 'bytes32', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ],
} as const

export const HOP_BRIDGE_ABI = [
  TRANSFER_SENT_EVENT,
  TRANSFER_SENT_TO_L2_EVENT,
  WITHDRAWAL_BONDED_EVENT,
] as const
