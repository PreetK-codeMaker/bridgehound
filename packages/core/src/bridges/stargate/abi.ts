/**
 * Stargate v2 (LayerZero OFT) event ABI fragments.
 *
 * These are the LayerZero OFT v2 standard events. Stargate's per-token OFT
 * contracts emit them on every cross-chain transfer:
 *
 *   - OFTSent on the source chain when a user calls `send()`.
 *   - OFTReceived on the destination chain when the relayer delivers.
 *
 * The `guid` is a LayerZero-assigned GUID that ties the two together — this
 * is the deterministic identifier we use as BridgeSend.messageId.
 *
 * VERIFY: Stargate's per-token OFT subclasses sometimes add extra fields. If
 * you find a contract whose event signature differs, decode against the
 * subclass's ABI rather than the standard OFT one.
 *
 * Source for the standard shape: layerzero-v2 monorepo,
 * packages/layerzero-v2/evm/oapp/contracts/oft/interfaces/IOFT.sol
 */

export const OFT_SENT_EVENT = {
  type: 'event',
  name: 'OFTSent',
  anonymous: false,
  inputs: [
    { name: 'guid', type: 'bytes32', indexed: true },
    { name: 'dstEid', type: 'uint32', indexed: false },
    { name: 'fromAddress', type: 'address', indexed: true },
    { name: 'amountSentLD', type: 'uint256', indexed: false },
    { name: 'amountReceivedLD', type: 'uint256', indexed: false },
  ],
} as const

export const OFT_RECEIVED_EVENT = {
  type: 'event',
  name: 'OFTReceived',
  anonymous: false,
  inputs: [
    { name: 'guid', type: 'bytes32', indexed: true },
    { name: 'srcEid', type: 'uint32', indexed: false },
    { name: 'toAddress', type: 'address', indexed: true },
    { name: 'amountReceivedLD', type: 'uint256', indexed: false },
  ],
} as const

export const STARGATE_OFT_ABI = [OFT_SENT_EVENT, OFT_RECEIVED_EVENT] as const
