/** design.md「WebSocket の通信」のエラーコード。 */
export type ErrorCode = "unauthorized" | "not_found" | "invalid_params" | "spawn_failed" | "internal";

export interface ProtocolError {
  code: ErrorCode;
  message: string;
}

export class RpcError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "RpcError";
  }
  toProtocolError(): ProtocolError {
    return { code: this.code, message: this.message };
  }
}
