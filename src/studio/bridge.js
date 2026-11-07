import { CLIPART, COLOURS, colourName, fontOf } from './options.jsx'

// A fresh design for a garment: white tee or black hoodie, nothing printed yet.
export const blankDesign = (product) => ({
  product,
  color: product === 'hoodie' ? COLOURS[1].hex : COLOURS[0].hex,
  layers: { front: [], back: [] },
})

// The garment colour as the review and checkout pages expect it (orders check it by name).
export const colourOf = (design) => ({ name: colourName(design.color), swatch: design.color })

// The studio's layers in the order format sent to /api/orders (see orderApi.js).
export function orderLayers(design) {
  const out = []
  for (const side of ['front', 'back']) {
    for (const l of design.layers[side]) {
      const base = { side, x: l.x, y: l.y, scale: l.scale / 100, rotate: l.rotate, color: l.color }
      if (l.kind === 'text') {
        if (!String(l.text || '').trim()) continue // an emptied text box prints nothing
        const f = fontOf(l.font)
        out.push({ ...base, type: 'text', text: l.text, font: { label: f.name, family: f.css, weight: f.weight } })
      } else if (l.kind === 'clip') {
        const c = CLIPART.find((x) => x.id === l.clip) || CLIPART[0]
        out.push({ ...base, type: 'clip', d: c.d, name: c.id })
      } else {
        out.push({ ...base, type: 'image', src: l.src, name: 'artwork.png' })
      }
    }
  }
  return out
}
