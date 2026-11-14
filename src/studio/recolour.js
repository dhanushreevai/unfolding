/*
  Recolours a garment photo like dyed fabric.

  The cut-out photo is a "shade map": how much light each point of the fabric catches. Instead
  of laying a flat colour over it (which reads as painted plastic), every pixel gets the new
  colour scaled by how much brighter or darker it is than the fabric's typical brightness, in
  linear light. Folds, seams and the knit texture keep their real contrast in any colour; the
  brightest highlights lift towards white. Dark dyes absorb light, so their folds show with
  less contrast and almost no highlight, as real black or navy cotton does. Fine per-pixel
  grain is softened slightly so fleece doesn't look gritty.

  A photo of black fabric has a much wider shading range than a white one (its shadows sit at a
  tenth of its highlights), so recolouring it to a light colour would look grey and blotchy.
  Its shading is compressed to the range real light fabric shows, more so the lighter the dye.
*/

const LIN = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const v = i / 255
  LIN[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const toSrgb = (v) => {
  const c = Math.min(1, Math.max(0, v))
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
}
const hexLin = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return [LIN[(n >> 16) & 255], LIN[(n >> 8) & 255], LIN[n & 255]]
}

const SHEEN = 0.015
const HIGHLIGHT = 0.25
const GAMMA = 1.0
const SMOOTH = 0.35 // share of the shade map taken from a slightly blurred copy

const SPREAD = 0.45 // shadow-to-highlight ratio of real light fabric (10th / 93rd percentile)

const refs = new Map() // typical fabric brightness and shading spread per photo

function referenceOf(src, data) {
  if (refs.has(src)) return refs.get(src)
  const vals = []
  for (let i = 0; i < data.length; i += 4 * 3) {
    if (data[i + 3] < 250) continue
    vals.push(0.2126 * LIN[data[i]] + 0.7152 * LIN[data[i + 1]] + 0.0722 * LIN[data[i + 2]])
  }
  vals.sort((a, b) => a - b)
  // near the brightest fabric, so almost all of it sits at or below the chosen colour and
  // keeps its folds and shadows (a lower reference flattens light colours to plain white)
  const ref = vals.length ? Math.max(0.02, vals[Math.floor(vals.length * 0.93)]) : 0.5
  const low = vals.length ? Math.max(1e-4, vals[Math.floor(vals.length * 0.1)]) : ref * SPREAD
  // < 1 when the photo's shading is wider than light fabric's (dark photos)
  const squeeze = Math.min(1, Math.log(SPREAD) / Math.log(Math.min(0.99, low / ref)))
  // dark photos have pure-black crease pixels: keep them from punching through light dyes
  const floor = ref * 0.08 * (1 - squeeze)
  const out = { ref, squeeze, floor }
  refs.set(src, out)
  return out
}

/** Returns a canvas with `img` recoloured to `color` (hex), at the image's own size. */
export function recolourCanvas(img, color) {
  const w = img.naturalWidth, h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  // a slightly blurred copy of the photo, for softening the fine grain
  ctx.filter = 'blur(1px)'
  ctx.drawImage(img, 0, 0)
  ctx.filter = 'none'
  const soft = ctx.getImageData(0, 0, w, h).data
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  const { ref, squeeze, floor } = referenceOf(img.src, d)
  const [cr, cg, cb] = hexLin(color)
  const lumC = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb
  const sheen = SHEEN * (1 - Math.min(1, lumC * 3)) // only dark colours get it
  const t = Math.min(1, lumC * 5) // 0 for black / navy, 1 for mid and light colours
  const gamma = GAMMA * (0.55 + 0.45 * t) * (1 - (1 - squeeze) * t)
  const smooth = SMOOTH + (1 - squeeze) * 0.4 * t // dark photos' grain shows on light dyes
  const hl = HIGHLIGHT * (0.1 + 0.9 * t)
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    const L0 = 0.2126 * LIN[d[i]] + 0.7152 * LIN[d[i + 1]] + 0.0722 * LIN[d[i + 2]]
    const Lb = 0.2126 * LIN[soft[i]] + 0.7152 * LIN[soft[i + 1]] + 0.0722 * LIN[soft[i + 2]]
    const L = Math.max(floor * t, L0 * (1 - smooth) + Lb * smooth)
    const r = (L / ref) ** gamma
    const lift = sheen * Math.min(r, 1.5) ** 2
    if (r <= 1) {
      d[i] = toSrgb(cr * r + lift)
      d[i + 1] = toSrgb(cg * r + lift)
      d[i + 2] = toSrgb(cb * r + lift)
    } else {
      const k = Math.min(1, (r - 1) * hl) // highlights catch the light, towards white
      d[i] = toSrgb(cr + (1 - cr) * k + lift)
      d[i + 1] = toSrgb(cg + (1 - cg) * k + lift)
      d[i + 2] = toSrgb(cb + (1 - cb) * k + lift)
    }
  }
  ctx.putImageData(id, 0, 0)
  return c
}

const images = new Map()
export const loadImage = (src) => {
  if (!images.has(src)) {
    images.set(src, new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    }))
  }
  return images.get(src)
}

const urls = new Map()
/** A URL of the recoloured photo (cached per photo and colour). */
export function recolouredUrl(src, color) {
  const key = `${src}|${String(color).toLowerCase()}`
  if (!urls.has(key)) {
    urls.set(key, loadImage(src).then((img) => {
      if (!img) return src
      return new Promise((resolve) => recolourCanvas(img, color).toBlob((b) => resolve(b ? URL.createObjectURL(b) : src)))
    }))
  }
  return urls.get(key)
}
