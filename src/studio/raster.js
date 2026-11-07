import { GARMENTS } from './garments.js'
import { CLIPART, fontOf, isDark } from './options.jsx'

/*
  Draws a studio design to a PNG (data URL), for view thumbnails and the order previews.
  Same recipe as the live Stage: the cut-out photo is a shade map, the garment colour is
  multiplied over it inside the garment's outline, and the print sits in the view's print area.
*/

const images = new Map()
const load = (src) => {
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

function tinted(img, color, w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(img, 0, 0, w, h)
  if (isDark(color)) {
    // the light sheen the live view adds on dark colours
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.13
    ctx.drawImage(img, 0, 0, w, h)
  }
  return c
}

async function drawLayer(ctx, l, area) {
  ctx.save()
  ctx.translate(area.x + (l.x / 100) * area.w, area.y + (l.y / 100) * area.h)
  ctx.rotate((l.rotate * Math.PI) / 180)
  if (l.kind === 'text') {
    const f = fontOf(l.font)
    const size = area.w * 0.2 * (l.scale / 100) // matches 20cqw in the live view
    const font = `${f.italic ? 'italic ' : ''}${f.weight} ${size}px ${f.css}`
    await document.fonts.load(font).catch(() => {})
    ctx.font = font
    ctx.fillStyle = l.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = String(l.text || '').split('\n')
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * size * 0.95))
  } else if (l.kind === 'clip') {
    const c = CLIPART.find((x) => x.id === l.clip) || CLIPART[0]
    const s = area.w * 0.4 * (l.scale / 100)
    ctx.translate(-s / 2, -s / 2)
    ctx.scale(s / 24, s / 24)
    const p = new Path2D(c.d)
    if (c.kind === 'fill') { ctx.fillStyle = l.color; ctx.fill(p) } else {
      ctx.strokeStyle = l.color; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p)
    }
  } else if (l.kind === 'image') {
    const img = await load(l.src)
    if (img) {
      const w = area.w * 0.7 * (l.scale / 100)
      const h = w * (img.naturalHeight / img.naturalWidth || 1)
      ctx.drawImage(img, -w / 2, -h / 2, w, h)
    }
  }
  ctx.restore()
}

export async function renderView(design, view, width = 300) {
  const g = GARMENTS[design.product]
  const v = g.views[view]
  const w = width, h = Math.round(width / g.ratio)
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  const ctx = out.getContext('2d')
  const photo = await load(v.src)
  if (!photo) return ''
  ctx.drawImage(tinted(photo, design.color, w, h), 0, 0)
  const layers = v.print ? design.layers[view] || [] : []
  if (layers.length) {
    const p = v.print
    const area = { x: (p.x / 100) * w, y: (p.y / 100) * h, w: (p.w / 100) * w, h: (p.h / 100) * h }
    ctx.save()
    ctx.beginPath()
    ctx.rect(area.x, area.y, area.w, area.h)
    ctx.clip()
    ctx.globalAlpha = 0.95
    for (const l of layers) await drawLayer(ctx, l, area)
    ctx.restore()
    if (v.over) {
      const over = await load(v.over)
      if (over) ctx.drawImage(tinted(over, design.color, w, h), 0, 0)
    }
  }
  return out.toDataURL('image/png')
}
