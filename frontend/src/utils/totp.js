// Minimal RFC 6238 TOTP generator that runs entirely in the browser using
// the Web Crypto API — no external library needed, so it works reliably
// inside Vite/React without bundler quirks.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  const clean = String(input || "")
    .replace(/=+$/, "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");

  let bits = "";
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

function intToBytes(num) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // JS numbers are safe up to 2^53; counter fits easily in the low 32 bits.
  view.setUint32(4, num);
  return new Uint8Array(buf);
}

async function hmacSha1(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}

export async function generateTotpCode(base32Secret, period = 30, digits = 6) {
  const keyBytes = base32Decode(base32Secret);
  if (keyBytes.length === 0) return null;

  const counter = Math.floor(Date.now() / 1000 / period);
  const msgBytes = intToBytes(counter);

  const hmac = await hmacSha1(keyBytes, msgBytes);
  const offset = hmac[hmac.length - 1] & 0x0f;

  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binCode % 10 ** digits).toString().padStart(digits, "0");
  return code;
}

export function secondsRemainingInPeriod(period = 30) {
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
}
