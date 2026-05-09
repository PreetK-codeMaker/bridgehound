export class BridgehoundError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined)
    this.name = this.constructor.name
  }
}

export class RPCError extends BridgehoundError {}
export class UnknownChainError extends BridgehoundError {}
export class BridgeDecodeError extends BridgehoundError {}
export class InvalidInputError extends BridgehoundError {}
export class RevertedTxError extends BridgehoundError {}
