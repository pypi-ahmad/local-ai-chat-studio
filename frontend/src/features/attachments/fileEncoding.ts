// Attachments feature: turns a browser File into a transport-safe string for upload.
// Does not touch the network itself — callers (e.g. the composer) pass the result to api/client.ts.
//
// Encodes the file's raw bytes as base64 by mapping each byte to a char code and
// running the browser's btoa(). This only handles binary-to-text encoding; it does
// not read/parse file content, so large files are held fully in memory as a binary string.
export async function fileAsBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
