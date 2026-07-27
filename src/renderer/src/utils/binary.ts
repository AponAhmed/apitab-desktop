/**
 * Base64 <-> ArrayBuffer conversion for file bytes crossing the renderer ->
 * main IPC boundary. A base64 string is JSON-safe by construction, sidestepping
 * any doubt about whether raw ArrayBuffer survives that hop intact (it does
 * not, empirically, on the extension's equivalent message-passing path).
 */

/** Chunked to avoid blowing the call stack on `String.fromCharCode(...bytes)` for large files. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
