/**
 * バイナリフレームのコーデック（design.md「WebSocket の通信」）。
 * 形式: [型 u8][pane id の長さ u8][pane id（UTF-8）][本体]
 *   0x01 OUTPUT   本体 = PTY の出力バイト列
 *   0x02 SNAPSHOT 本体 = cols u16 (LE) + rows u16 (LE) + serialize した文字列（UTF-8）
 *   0x03 INPUT    本体 = 端末への入力バイト列
 */

export const FRAME_TYPE = {
  OUTPUT: 0x01,
  SNAPSHOT: 0x02,
  INPUT: 0x03,
} as const;
export type FrameType = (typeof FRAME_TYPE)[keyof typeof FRAME_TYPE];

const enc = new TextEncoder();
const dec = new TextDecoder();

function encodePaneIdHeader(paneId: string): Uint8Array {
  const idBytes = enc.encode(paneId);
  if (idBytes.length > 255) {
    throw new RangeError(`pane id too long for frame header: ${paneId}`);
  }
  return idBytes;
}

export function encodeOutputFrame(paneId: string, chunk: Uint8Array): Uint8Array {
  const idBytes = encodePaneIdHeader(paneId);
  const out = new Uint8Array(2 + idBytes.length + chunk.length);
  out[0] = FRAME_TYPE.OUTPUT;
  out[1] = idBytes.length;
  out.set(idBytes, 2);
  out.set(chunk, 2 + idBytes.length);
  return out;
}

export function encodeSnapshotFrame(paneId: string, cols: number, rows: number, text: string): Uint8Array {
  const idBytes = encodePaneIdHeader(paneId);
  const textBytes = enc.encode(text);
  const out = new Uint8Array(2 + idBytes.length + 4 + textBytes.length);
  out[0] = FRAME_TYPE.SNAPSHOT;
  out[1] = idBytes.length;
  out.set(idBytes, 2);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint16(2 + idBytes.length, cols, true);
  view.setUint16(2 + idBytes.length + 2, rows, true);
  out.set(textBytes, 2 + idBytes.length + 4);
  return out;
}

export function encodeInputFrame(paneId: string, bytes: Uint8Array): Uint8Array {
  const idBytes = encodePaneIdHeader(paneId);
  const out = new Uint8Array(2 + idBytes.length + bytes.length);
  out[0] = FRAME_TYPE.INPUT;
  out[1] = idBytes.length;
  out.set(idBytes, 2);
  out.set(bytes, 2 + idBytes.length);
  return out;
}

export type DecodedFrame =
  | { type: typeof FRAME_TYPE.OUTPUT; paneId: string; chunk: Uint8Array }
  | { type: typeof FRAME_TYPE.SNAPSHOT; paneId: string; cols: number; rows: number; text: string }
  | { type: typeof FRAME_TYPE.INPUT; paneId: string; bytes: Uint8Array };

export function decodeFrame(frame: Uint8Array): DecodedFrame {
  if (frame.length < 2) throw new RangeError("frame too short");
  const type = frame[0] as FrameType;
  const idLen = frame[1] as number;
  if (frame.length < 2 + idLen) throw new RangeError("frame truncated (pane id)");
  const paneId = dec.decode(frame.subarray(2, 2 + idLen));
  const bodyStart = 2 + idLen;
  switch (type) {
    case FRAME_TYPE.OUTPUT:
      return { type, paneId, chunk: frame.subarray(bodyStart) };
    case FRAME_TYPE.INPUT:
      return { type, paneId, bytes: frame.subarray(bodyStart) };
    case FRAME_TYPE.SNAPSHOT: {
      if (frame.length < bodyStart + 4) throw new RangeError("frame truncated (snapshot header)");
      const view = new DataView(frame.buffer, frame.byteOffset + bodyStart, 4);
      const cols = view.getUint16(0, true);
      const rows = view.getUint16(2, true);
      const text = dec.decode(frame.subarray(bodyStart + 4));
      return { type, paneId, cols, rows, text };
    }
    default:
      throw new RangeError(`unknown frame type: ${String(type)}`);
  }
}
