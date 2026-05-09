import { describe, expect, it } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, type Log } from 'viem'
import { FUNDS_DEPOSITED_EVENT } from '../../../src/bridges/across/abi.js'
import { acrossAdapter } from '../../../src/bridges/across/index.js'
import { SPOKE_POOL } from '../../../src/bridges/across/addresses.js'
import type { NormalizedTx } from '../../../src/types.js'

const ETHEREUM = 1
const ARBITRUM = 42161

const SENDER = '0x1111111111111111111111111111111111111111' as const
const RECIPIENT = '0x2222222222222222222222222222222222222222' as const
const TOKEN = '0x3333333333333333333333333333333333333333' as const

function leftPad32(hexAddr: `0x${string}`): `0x${string}` {
  return `0x${'0'.repeat(24)}${hexAddr.slice(2)}` as `0x${string}`
}

function makeFundsDepositedLog(args: {
  spoke: `0x${string}`
  destinationChainId: bigint
  depositId: bigint
  depositor: `0x${string}`
  recipient: `0x${string}`
  inputToken: `0x${string}`
  inputAmount: bigint
}): Log {
  const topics = encodeEventTopics({
    abi: [FUNDS_DEPOSITED_EVENT],
    eventName: 'FundsDeposited',
    args: {
      destinationChainId: args.destinationChainId,
      depositId: args.depositId,
      depositor: leftPad32(args.depositor),
    },
  })

  const data = encodeAbiParameters(
    [
      { name: 'inputToken', type: 'bytes32' },
      { name: 'outputToken', type: 'bytes32' },
      { name: 'inputAmount', type: 'uint256' },
      { name: 'outputAmount', type: 'uint256' },
      { name: 'quoteTimestamp', type: 'uint32' },
      { name: 'fillDeadline', type: 'uint32' },
      { name: 'exclusivityDeadline', type: 'uint32' },
      { name: 'recipient', type: 'bytes32' },
      { name: 'exclusiveRelayer', type: 'bytes32' },
      { name: 'message', type: 'bytes' },
    ],
    [
      leftPad32(args.inputToken),
      leftPad32(args.inputToken),
      args.inputAmount,
      args.inputAmount,
      0,
      0,
      0,
      leftPad32(args.recipient),
      leftPad32('0x0000000000000000000000000000000000000000'),
      '0x',
    ],
  )

  return {
    address: args.spoke,
    topics,
    data,
    blockNumber: 1n,
    transactionHash: '0xdeadbeef',
    transactionIndex: 0,
    blockHash: '0xblock',
    logIndex: 0,
    removed: false,
  } as unknown as Log
}

function baseTx(chainId: number, to: `0x${string}`): NormalizedTx {
  return {
    chainId,
    hash: '0xtx',
    blockNumber: 100n,
    timestamp: 1_700_000_000,
    from: SENDER,
    to,
    value: 0n,
    input: '0x',
  }
}

describe('AcrossAdapter.matches', () => {
  it('returns true for the SpokePool address on a supported chain', () => {
    const spoke = SPOKE_POOL[ETHEREUM]!
    expect(acrossAdapter.matches(ETHEREUM, spoke)).toBe(true)
  })

  it('is case-insensitive on the contract address', () => {
    const spoke = SPOKE_POOL[ETHEREUM]!.toLowerCase() as `0x${string}`
    expect(acrossAdapter.matches(ETHEREUM, spoke)).toBe(true)
  })

  it('returns false for an unrelated contract on a supported chain', () => {
    expect(acrossAdapter.matches(ETHEREUM, '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead')).toBe(false)
  })

  it('returns false on an unsupported chain even for a known address', () => {
    expect(acrossAdapter.matches(9999, SPOKE_POOL[ETHEREUM]!)).toBe(false)
  })
})

describe('AcrossAdapter.parseSend', () => {
  it('decodes a FundsDeposited log into a BridgeSend', () => {
    const spoke = SPOKE_POOL[ETHEREUM]!
    const tx = baseTx(ETHEREUM, spoke)
    const log = makeFundsDepositedLog({
      spoke,
      destinationChainId: BigInt(ARBITRUM),
      depositId: 4321n,
      depositor: SENDER,
      recipient: RECIPIENT,
      inputToken: TOKEN,
      inputAmount: 1_000_000n,
    })

    const send = acrossAdapter.parseSend(tx, [log])
    expect(send).not.toBeNull()
    expect(send!.bridge).toBe('across')
    expect(send!.srcChain).toBe(ETHEREUM)
    expect(send!.dstChain).toBe(ARBITRUM)
    expect(send!.amount).toBe(1_000_000n)
    expect(send!.messageId).toBe('4321')
    // viem checksums recovered addresses; lowercase the comparison.
    expect(send!.recipient!.toLowerCase()).toBe(RECIPIENT)
    expect(send!.token.address!.toLowerCase()).toBe(TOKEN)
  })

  it('returns null when no FundsDeposited log is present', () => {
    const spoke = SPOKE_POOL[ETHEREUM]!
    const tx = baseTx(ETHEREUM, spoke)
    expect(acrossAdapter.parseSend(tx, [])).toBeNull()
  })

  it('returns null on an unsupported chain', () => {
    const tx = baseTx(9999, SPOKE_POOL[ETHEREUM]!)
    expect(acrossAdapter.parseSend(tx, [])).toBeNull()
  })

  it('ignores logs that match topic0 but originate from a non-SpokePool address', () => {
    const spoke = SPOKE_POOL[ETHEREUM]!
    const tx = baseTx(ETHEREUM, spoke)
    const log = makeFundsDepositedLog({
      spoke: '0x9999999999999999999999999999999999999999',
      destinationChainId: BigInt(ARBITRUM),
      depositId: 1n,
      depositor: SENDER,
      recipient: RECIPIENT,
      inputToken: TOKEN,
      inputAmount: 42n,
    })
    expect(acrossAdapter.parseSend(tx, [log])).toBeNull()
  })

  it('returns null on a non-EVM destination (recipient bytes32 with non-zero upper bytes)', () => {
    const spoke = SPOKE_POOL[ETHEREUM]!
    const tx = baseTx(ETHEREUM, spoke)
    const topics = encodeEventTopics({
      abi: [FUNDS_DEPOSITED_EVENT],
      eventName: 'FundsDeposited',
      args: {
        destinationChainId: BigInt(ARBITRUM),
        depositId: 7n,
        depositor: leftPad32(SENDER),
      },
    })
    // Pack a recipient whose upper bytes are non-zero — that's how Across
    // encodes Solana destinations. parseSend should bail rather than
    // decode garbage as an EVM address.
    const solanaRecipient = `0x11${'22'.repeat(31)}` as `0x${string}`
    const data = encodeAbiParameters(
      [
        { name: 'inputToken', type: 'bytes32' },
        { name: 'outputToken', type: 'bytes32' },
        { name: 'inputAmount', type: 'uint256' },
        { name: 'outputAmount', type: 'uint256' },
        { name: 'quoteTimestamp', type: 'uint32' },
        { name: 'fillDeadline', type: 'uint32' },
        { name: 'exclusivityDeadline', type: 'uint32' },
        { name: 'recipient', type: 'bytes32' },
        { name: 'exclusiveRelayer', type: 'bytes32' },
        { name: 'message', type: 'bytes' },
      ],
      [
        leftPad32(TOKEN),
        leftPad32(TOKEN),
        1n,
        1n,
        0,
        0,
        0,
        solanaRecipient,
        leftPad32('0x0000000000000000000000000000000000000000'),
        '0x',
      ],
    )
    const log = {
      address: spoke,
      topics,
      data,
      blockNumber: 1n,
      transactionHash: '0xdeadbeef',
      transactionIndex: 0,
      blockHash: '0xblock',
      logIndex: 0,
      removed: false,
    } as unknown as Log

    expect(acrossAdapter.parseSend(tx, [log])).toBeNull()
  })
})
