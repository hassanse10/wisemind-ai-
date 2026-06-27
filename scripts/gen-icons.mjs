// Generates simple brand placeholder PNG icons (16/48/128) for the extension.
// Solid rounded-look square with a "W" mark, brand blue→teal. No deps beyond
// Node's built-in zlib. Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

// Simple linear blend between brand blue (#2563eb) and teal (#14b8a6).
function blend(t) {
  const a = [0x25, 0x63, 0xeb], b = [0x14, 0xb8, 0xa6]
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

function makePNG(size) {
  const px = (x, y) => {
    // rounded corners → transparent
    const r = size * 0.22
    const cx = Math.min(x, size - 1 - x), cy = Math.min(y, size - 1 - y)
    if (cx < r && cy < r) {
      const dx = r - cx, dy = r - cy
      if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0]
    }
    const [rr, gg, bb] = blend((x + y) / (2 * size))
    // draw a rough "W" in white
    const u = x / size, v = y / size
    const inW = v > 0.30 && v < 0.74 && (
      Math.abs(u - (0.18 + (v - 0.30) * 0.30)) < 0.07 ||
      Math.abs(u - (0.82 - (v - 0.30) * 0.30)) < 0.07 ||
      Math.abs(u - (0.40 + (v - 0.30) * 0.18)) < 0.06 ||
      Math.abs(u - (0.60 - (v - 0.30) * 0.18)) < 0.06
    )
    return inW ? [255, 255, 255, 255] : [rr, gg, bb, 255]
  }
  const raw = Buffer.alloc((size * 4 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = px(x, y)
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit, RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const s of [16, 48, 128]) {
  writeFileSync(resolve(outDir, `icon${s}.png`), makePNG(s))
  console.log(`wrote public/icons/icon${s}.png`)
}
