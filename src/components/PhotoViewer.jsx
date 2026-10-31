import { useEffect, useRef, useState } from 'react'
import { VIEWS, viewFromAngle } from './garment.js'

/*
  Product gallery in the style of big sportswear stores: still shots that crossfade.
  Shots: front and back photos with the customer's print, and real left/right side photos.
  Moving between shots crossfades; dragging slides the photo slightly; hovering a showcase
  zooms into the fabric under the pointer.
*/

const W = 820, H = 960 // shots are rendered at 2x the 410x480 stage
const SHOTS = {
  front: { side: 'front' },
  back: { side: 'back' },
  // real side photos: public/<name>-left.jpg and -right.jpg (prints sit on the front/back only)
  left: { side: 'left' },
  right: { side: 'right' },
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
  const base = product.img.replace(/\.\w+$/, '')
  const own = side === 'left' || side === 'right' ? `-${side}` : ''
  const photoUrl = back ? `${base}-back.jpg` : own ? `${base}${own}.jpg` : product.img
  const [photo, mask] = await Promise.all([loadImage(photoUrl), maskCanvas(`${base}${own}-mask.png`)])
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
  const [sides, setSides] = useState({})
  const flat = useRef(null) // painted canvases per side, for thumbnails
  const [hover, setHover] = useState(null)
  const hostRef = useRef(null)
  const view = viewFromAngle(angle)

  // The shown angle eases towards the requested one every frame: closely while dragging, and as a
  // smooth turn (passing through the in-between photos) when a view button is pressed.
  const [shown, setShown] = useState(angle)
  const live = useRef({ angle, immediate })
  live.current = { angle, immediate }
  useEffect(() => {
    let raf, last = performance.now(), cur = shown
    let tween = null // { from, to, start, dur } for button / release turns
    const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { angle: target, immediate: imm } = live.current
      if (imm) {
        // dragging: follow the finger smoothly
        tween = null
        cur += (target - cur) * (1 - Math.exp(-dt * 22))
        setShown(cur)
      } else if (Math.abs(target - cur) > 0.05 || tween) {
        // a turn to a view: start gently, speed up, slow into place (about 1.7s per quarter turn)
        if (!tween || tween.to !== target) {
          const dist = Math.abs(target - cur)
          tween = { from: cur, to: target, start: now, dur: 800 + dist * 10 }
        }
        const k = Math.min(1, (now - tween.start) / tween.dur)
        cur = tween.from + (tween.to - tween.from) * easeInOut(k)
        if (k >= 1) { cur = tween.to; tween = null }
        setShown(cur)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // which two photos are on screen and how far between them: front 0, right 90, back 180, left 270
  const ORDER = ['front', 'right', 'back', 'left']
  const a = ((shown % 360) + 360) % 360
  const qi = Math.floor(a / 90) % 4
  const t = a / 90 - Math.floor(a / 90)
  const from = ORDER[qi], to = ORDER[(qi + 1) % 4]
  const smooth = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k) }
  const mix = smooth(0.18, 0.82, t)
  const shotStyle = (id) => {
    let k, opacity
    if (id === from) { k = t; opacity = 1 - mix } else if (id === to) { k = t - 1; opacity = mix } else return { opacity: 0 }
    // turning: rotate away in perspective, drift sideways, and fall into shade as it turns edge-on
    const turn = Math.sin(Math.abs(k) * Math.PI / 2)
    return {
      opacity,
      zIndex: opacity > 0.5 ? 2 : 1,
      transform: `translateX(${(k * 14).toFixed(2)}%) rotateY(${(k * 55).toFixed(2)}deg) scale(${(1 - 0.05 * turn).toFixed(4)})`,
      filter: `brightness(${(1 - 0.45 * turn).toFixed(3)})`,
    }
  }

  useEffect(() => { onPrintRect?.(product.print) }, [product.print])

  // paint every shot whenever the product, colour or design changes
  const paintedFor = useRef(null)
  useEffect(() => {
    let on = true
    // switching garment: drop the old garment's shots at once so it never shows under the new name
    if (paintedFor.current !== product.img) {
      paintedFor.current = product.img
      flat.current = null
      setSides({})
    }
    const names = ['front', 'back', 'left', 'right']
    Promise.all(names.map((n) => paintSide(product, color, layers, n))).then((canvases) => {
      if (!on) return
      flat.current = Object.fromEntries(names.map((n, i) => [n, canvases[i]]))
      setSides(Object.fromEntries(names.map((n, i) => [n, canvases[i].toDataURL('image/png')])))
    })
    return () => { on = false }
  }, [product.img, color, layers])

  // thumbnails once the shots are painted
  useEffect(() => {
    if (!onThumbs || !thumbAngles) return
    if (!flat.current) { onThumbs([]); return }
    onThumbs(thumbAngles.map((a) => {
      const shot = SHOTS[viewFromAngle(a).id]
      return thumbOf(flat.current[shot.side], zoomOf(shot, product))
    }))
  }, [sides, thumbAngles?.join()])

  // tell the page when the garment has stopped turning (the print box is shown only then)
  const atRest = !immediate && Math.abs(shown - angle) < 0.5
  useEffect(() => { onSettle?.(atRest) }, [atRest])

  useEffect(() => { onZoom?.(!!hover && !immediate) }, [!!hover && !immediate])

  const onMove = (e) => {
    if (!showcase || immediate || e.pointerType !== 'mouse') return
    const r = hostRef.current.getBoundingClientRect()
    setHover({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  return (
    <div ref={hostRef} className={`g3d photo-viewer${showcase ? ' zoomable' : ''}`}
      onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {VIEWS.map((v) => {
        const shot = SHOTS[v.id]
        const src = sides[shot.side]
        const active = v.id === view.id
        const resting = Math.abs(shown - angle) < 1 && !immediate
        const zoom = zoomOf(shot, product)
        let transform = zoom ? `scale(${zoom.scale})` : 'scale(1)'
        let origin = zoom ? `${zoom.x * 100}% ${zoom.y * 100}%` : '50% 50%'
        if (active && hover && resting) {
          // hover zoom: magnify under the pointer
          transform = `scale(${(zoom ? zoom.scale : 1) * 1.7})`
          origin = `${hover.x * 100}% ${hover.y * 100}%`
        }
        return (
          <div key={v.id} className={`shot${active ? ' on' : ''}`} style={shotStyle(shot.side)}>
            {src && <img src={src} alt="" draggable="false" style={{ transform, transformOrigin: origin }} />}
          </div>
        )
      })}
    </div>
  )
}
