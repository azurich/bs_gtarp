/* ============================================================
   BlackState — TOTP (RFC 6238) sans dépendance, via node:crypto.
   Compatible Google Authenticator / Authy / Microsoft Authenticator.
============================================================ */
import { createHmac, randomBytes } from 'node:crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP = 30          // période en secondes
const DIGITS = 6

/* secret base32 aléatoire (20 octets = 160 bits, recommandé) */
export function generateSecret(bytes = 20): string {
  const buf = randomBytes(bytes)
  let bits = '', out = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function base32Decode(s: string): Buffer {
  s = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const c of s) bits += B32.indexOf(c).toString(2).padStart(5, '0')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const h = createHmac('sha1', secret).update(buf).digest()
  const off = h[h.length - 1] & 0xf
  const bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff)
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, '0')
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/* vérifie un code à 6 chiffres avec une tolérance de ±window pas (±30 s par défaut) */
export function verifyTOTP(secretB32: string, token: string, window = 1): boolean {
  if (!/^\d{6}$/.test(token || '')) return false
  const secret = base32Decode(secretB32)
  if (!secret.length) return false
  const counter = Math.floor(Date.now() / 1000 / STEP)
  for (let i = -window; i <= window; i++) {
    if (timingSafeEq(hotp(secret, counter + i), token)) return true
  }
  return false
}

/* exposé pour les tests (vecteurs RFC) — ne pas utiliser ailleurs */
export const _internal = { hotp, base32Decode }

/* URI otpauth:// à encoder en QR code */
export function otpauthURI(secretB32: string, account: string, issuer = 'BlackState'): string {
  const label = encodeURIComponent(issuer) + ':' + encodeURIComponent(account)
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`
}
