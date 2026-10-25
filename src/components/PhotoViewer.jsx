import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { VIEWS, viewFromAngle } from './garment.js'

// There are no side photos, so the side shots are rendered once from the front photo by the
// 3D renderer (offscreen, loaded on demand) and then shown as still gallery shots.
const Garment3D = lazy(() => import('./Garment3D.jsx'))
const SIDE_ANGLES = [-40, 40]

/*
  Product gallery in the style of big sportswear stores: still shots that crossfade.
  Shots: front and back photos with the customer's print, and left/right side shots.
  Moving between shots crossfades; dragging slides the photo slightly; hovering a showcase
  zooms into the fabric under the pointer.
*/

const W = 820, H = 960 // shots are rendered at 2x the 410x480 stage
const SHOTS = {
  front: { side: 'front' },
  back: { side: 'back' },
  left: { rendered: 0 }, // index into SIDE_ANGLES
  right: { rendered: 1 },
}

const pct = (v) => parseFloat(v) / 100
const isLight = (hex) => {
  const v = parseInt(hex.slice(1), 16)
  return ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11 > 128
}
const images = new Map()
const loadImage = (url) => {
  if (!images.has(url)) {
    images.set(url, new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    }))
  }
  return images.get(url)
}
const masks = new Map()
// the cut-out mask (greyscale) as an alpha channel, cover-fitted to the stage
async function maskCanvas(url) {
  if (!masks.has(url)) {
    masks.set(url, loadImage(url).then((img) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!img) return null
      cover(ctx, img)
      const d = ctx.getImageData(0, 0, W, H)
      for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255 }
      ctx.putImageData(d, 0, 0)
      return c
    }))
  }
  return masks.get(url)
}
function cover(ctx, img) {
  const s = Math.max(W / img.width, H / img.height)
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s)
}

function drawLayers(ctx, layers, rect, images) {
  for (const l of layers) {
    ctx.save()
    ctx.translate(rect.x + (l.x / 100) * rect.w, rect.y + (l.y / 100) * rect.h)
    ctx.rotate((l.rotate * Math.PI) / 180)
    if (l.type === 'text') {
      ctx.font = `${l.font.weight} ${0.16 * rect.w * l.scale}px ${l.font.family}`
      ctx.fillStyle = l.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(l.text.toUpperCase(), 0, 0)
    } else if (l.type === 'clip') {
      const s = 0.45 * rect.w * l.scale
      ctx.translate(-s / 2, -s / 2)
      ctx.scale(s / 24, s / 24)
      ctx.fillStyle = l.color
      ctx.fill(new Path2D(l.d))
    } else {
      const img = images.get(l.src)
      if (img) {
        const w = 0.7 * rect.w * l.scale, h = w * (img.naturalHeight / img.naturalWidth)
        ctx.drawImage(img, -w / 2, -h / 2, w, h)
      }
    }
    ctx.restore()
  }
}

// One side of the garment: photo, colour, print and cut-out, as a canvas.
async function paintSide(product, color, layers, side) {
  const back = side === 'back'
  const photoUrl = back ? product.img.replace(/\.\w+$/, '-back.jpg') : product.img
  const [photo, mask] = await Promise.all([loadImage(photoUrl), maskCanvas(product.img.replace(/\.\w+$/, '-mask.png'))])
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  if (!photo) return c
  ctx.save()
  // seen from behind, the garment's left and right swap
  if (back) { ctx.translate(W, 0); ctx.scale(-1, 1) }
  if (color.bright && color.bright !== 1) ctx.filter = `brightness(${color.bright})`
  cover(ctx, photo)
  ctx.filter = 'none'
  if (color.tint && color.tint.toLowerCase() !== '#ffffff') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = color.tint
    ctx.fillRect(0, 0, W, H)
  }
  if (mask) {
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, 0, 0)
  }
  ctx.restore()
  const sideLayers = layers.filter((l) => l.side === side)
  if (sideLayers.length) {
    const imgs = new Map()
    await Promise.all(sideLayers.filter((l) => l.type === 'image').map(async (l) => imgs.set(l.src, await loadImage(l.src))))
    await document.fonts.ready
    // on light fabric the ink multiplies with the photo, so folds and shadows show through it
    ctx.globalCompositeOperation = isLight(color.swatch) ? 'multiply' : 'source-over'
    const p = product.print
    drawLayers(ctx, sideLayers, { x: pct(p.left) * W, y: pct(p.top) * H, w: pct(p.width) * W, h: pct(p.height) * H }, imgs)
    ctx.globalCompositeOperation = 'source-over'
  }
  return c
}

// where each close-up looks, and how far it zooms (origin as a share of the stage)
function zoomOf(shot, product) {
  if (shot.zoom === 'print') {
    const p = product.print
    return { x: pct(p.left) + pct(p.width) / 2, y: pct(p.top) + pct(p.height) / 2, scale: 1.9 }
  }
  if (shot.zoom === 'fabric') return { x: 0.5, y: 0.86, scale: 2.4 }
  return null
}

function thumbOf(canvas, zoom) {
  const t = document.createElement('canvas')
  t.width = 300; t.height = 352
  const ctx = t.getContext('2d')
  if (zoom) {
    const w = W / zoom.scale, h = H / zoom.scale
    const x = Math.min(W - w, Math.max(0, zoom.x * W - w / 2)), y = Math.min(H - h, Math.max(0, zoom.y * H - h / 2))
    ctx.drawImage(canvas, x, y, w, h, 0, 0, t.width, t.height)
  } else ctx.drawImage(canvas, 0, 0, t.width, t.height)
  return t.toDataURL('image/png')
}

export default function PhotoViewer({
  product, color, layers, angle, immediate = false, showcase = false,
  onSettle, onThumbs, thumbAngles, onPrintRect, onZoom,
}) {
  const [sides, setSides] = useState({ front: null, back: null })
  const [sideShots, setSideShots] = useState([null, null])
  const [renderSides, setRenderSides] = useState(false)
  const flat = useRef(null) // { front, back } canvases, for thumbnails
  const [hover, setHover] = useState(null)
  const hostRef = useRef(null)
  const view = viewFromAngle(angle)
  const shotView = VIEWS.find((v) => v.id === view.id)
  // how far the current drag has pulled away from the shot, for a gentle slide
  const pull = Math.max(-1, Math.min(1, ((((angle - shotView.angle + 180) % 360) + 360) % 360 - 180) / 40))

  useEffect(() => { onPrintRect?.(product.print) }, [product.print])

  // render both sides whenever the product, colour or design changes
  useEffect(() => {
    let on = true
    Promise.all([paintSide(product, color, layers, 'front'), paintSide(product, color, layers, 'back')]).then(([front, back]) => {
      if (!on) return
      flat.current = { front, back }
      setSides({ front: front.toDataURL('image/png'), back: back.toDataURL('image/png') })
    })
    // re-render the side shots once the design has stopped changing for a moment
    const id = setTimeout(() => setRenderSides(true), 500)
    return () => { on = false; clearTimeout(id) }
  }, [product.img, color, layers])

  // thumbnails once the photos (and side shots, when ready) are in
  useEffect(() => {
    if (!onThumbs || !thumbAngles || !flat.current) return
    onThumbs(thumbAngles.map((a) => {
      const shot = SHOTS[viewFromAngle(a).id]
      if (shot.rendered !== undefined) return sideShots[shot.rendered] || ''
      return thumbOf(shot.side === 'back' ? flat.current.back : flat.current.front, zoomOf(shot, product))
    }))
  }, [sides, sideShots, thumbAngles?.join()])

  // tell the page when a shot has finished fading in (prints are edited only then)
  useEffect(() => {
    onSettle?.(false)
    const id = setTimeout(() => onSettle?.(true), 450)
    return () => clearTimeout(id)
  }, [view.id])

  useEffect(() => { onZoom?.(!!hover && !immediate) }, [!!hover && !immediate])

  const onMove = (e) => {
    if (!showcase || immediate) return
    const r = hostRef.current.getBoundingClientRect()
    setHover({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  return (
    <div ref={hostRef} className={`g3d photo-viewer${showcase ? ' zoomable' : ''}`}
      onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {VIEWS.map((v) => {
        const shot = SHOTS[v.id]
        const src = shot.rendered !== undefined ? sideShots[shot.rendered] : sides[shot.side]
        const active = v.id === view.id
        const zoom = zoomOf(shot, product)
        let transform = zoom ? `scale(${zoom.scale})` : 'scale(1)'
        let origin = zoom ? `${zoom.x * 100}% ${zoom.y * 100}%` : '50% 50%'
        if (active && hover && !immediate) {
          // hover zoom: magnify under the pointer
          transform = `scale(${(zoom ? zoom.scale : 1) * 1.7})`
          origin = `${hover.x * 100}% ${hover.y * 100}%`
        }
        return (
          <div key={v.id} className={`shot${active ? ' on' : ''}`}
            style={{ transform: active && immediate ? `translateX(${(pull * 6).toFixed(2)}%)` : undefined }}>
            {src && <img src={src} alt="" draggable="false" style={{ transform, transformOrigin: origin }} />}
          </div>
        )
      })}
      {renderSides && (
        <div className="side-renderer" aria-hidden="true">
          <Suspense fallback={null}>
            <Garment3D product={product} color={color} layers={layers} angle={0} fullSnapshots
              thumbAngles={SIDE_ANGLES} onThumbs={(urls) => { setSideShots(urls); setRenderSides(false) }} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
