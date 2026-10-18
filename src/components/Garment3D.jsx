import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Texture canvas size — matches the stage's 410:480 aspect ratio.
export const TEX_W = 820
export const TEX_H = 960
const GRID_W = 150
const GRID_H = 176
const PLANE_H = 1
const PLANE_W = TEX_W / TEX_H
const FOV = 16
const CAM_DIST = PLANE_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180)
const DEPTH = 0.085 // max half-thickness of the garment body
const ROUND = 0.2 // distance from the edge over which the body rounds off
// The print area sits on the bulged surface, slightly nearer the camera than z=0.
export const OVERLAY_SCALE = CAM_DIST / (CAM_DIST - DEPTH)

const rad = (d) => (d * Math.PI) / 180

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = src
})

/* ---------- silhouette mask + inflated mesh ---------- */

// Each garment photo has a pre-cut alpha mask next to it (public/<name>-mask.png).
function maskCanvases(alpha) {
  const make = (mirror) => {
    const c = document.createElement('canvas')
    c.width = TEX_W; c.height = TEX_H
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(TEX_W, TEX_H)
    for (let y = 0; y < TEX_H; y++) {
      for (let x = 0; x < TEX_W; x++) {
        const o = (y * TEX_W + x) * 4
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 255
        img.data[o + 3] = alpha[y * TEX_W + (mirror ? TEX_W - 1 - x : x)]
      }
    }
    ctx.putImageData(img, 0, 0)
    return c
  }
  return { front: make(false), back: make(true) }
}

function buildGeometry(keep) {
  const cols = GRID_W + 1, rows = GRID_H + 1, V = cols * rows
  const inside = new Uint8Array(V)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const px = Math.min(TEX_W - 1, Math.round((i / GRID_W) * (TEX_W - 1)))
      const py = Math.min(TEX_H - 1, Math.round((j / GRID_H) * (TEX_H - 1)))
      inside[j * cols + i] = keep[py * TEX_W + px]
    }
  }

  // chamfer distance (in cells) from the silhouette edge
  const dist = new Float32Array(V)
  for (let k = 0; k < V; k++) dist[k] = inside[k] ? 1e9 : 0
  const D = Math.SQRT2
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i
    if (!dist[k]) continue
    if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + 1)
    if (j > 0) dist[k] = Math.min(dist[k], dist[k - cols] + 1)
    if (i > 0 && j > 0) dist[k] = Math.min(dist[k], dist[k - cols - 1] + D)
    if (i < cols - 1 && j > 0) dist[k] = Math.min(dist[k], dist[k - cols + 1] + D)
    if (i === 0 || j === 0 || i === cols - 1 || j === rows - 1) dist[k] = Math.min(dist[k], 1)
  }
  for (let j = rows - 1; j >= 0; j--) for (let i = cols - 1; i >= 0; i--) {
    const k = j * cols + i
    if (!dist[k]) continue
    if (i < cols - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 1)
    if (j < rows - 1) dist[k] = Math.min(dist[k], dist[k + cols] + 1)
    if (i < cols - 1 && j < rows - 1) dist[k] = Math.min(dist[k], dist[k + cols + 1] + D)
    if (i > 0 && j < rows - 1) dist[k] = Math.min(dist[k], dist[k + cols - 1] + D)
  }

  // rounded "inflated" profile, smoothed to remove ridges along the medial axis
  const cell = PLANE_W / GRID_W
  let depth = new Float32Array(V)
  for (let k = 0; k < V; k++) {
    const t = Math.min(1, Math.max(0, (dist[k] - 0.7) * cell / ROUND))
    depth[k] = DEPTH * (1 - (1 - t) * (1 - t))
  }
  for (let pass = 0; pass < 5; pass++) {
    const next = new Float32Array(V)
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i
      if (!inside[k]) continue
      let s = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ii = i + dx, jj = j + dy
        if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue
        s += depth[jj * cols + ii]; n++
      }
      next[k] = s / n
    }
    depth = next
  }

  const pos = new Float32Array(V * 2 * 3)
  const uv = new Float32Array(V * 2 * 2)
  for (let s = 0; s < 2; s++) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i, o = s * V + k
      pos[o * 3] = (i / GRID_W - 0.5) * PLANE_W
      pos[o * 3 + 1] = (0.5 - j / GRID_H) * PLANE_H
      pos[o * 3 + 2] = s ? -depth[k] : depth[k]
      // the back shell's u is flipped so its texture reads correctly when seen from behind
      uv[o * 2] = s ? 1 - i / GRID_W : i / GRID_W
      uv[o * 2 + 1] = 1 - j / GRID_H
    }
  }

  const front = [], back = []
  for (let j = 0; j < GRID_H; j++) for (let i = 0; i < GRID_W; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1
    if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue
    front.push(a, c, b, b, c, d)
    back.push(V + a, V + b, V + c, V + b, V + d, V + c)
  }
  let lowest = 0
  for (let k = 0; k < V; k++) if (inside[k]) lowest = Math.max(lowest, Math.floor(k / cols))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex([...front, ...back])
  geo.addGroup(0, front.length, 0)
  geo.addGroup(front.length, back.length, 1)
  geo.computeVertexNormals()
  geo.userData.hemY = 0.5 - lowest / GRID_H
  return geo
}

/* ---------- surface detail: synthetic back, fabric bump, ink shading ---------- */

const lumAt = (d, o) => d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11

// Box blur of a Float32Array plane in place (horizontal then vertical), radius r.
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length)
  const n = 2 * r + 1
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      src[y * w + x] = acc / n
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return src
}

function fabricLevels(photo, alpha) {
  const hist = new Uint32Array(256)
  let n = 0
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] > 127) { hist[Math.round(lumAt(photo.data, i * 4))]++; n++ }
  }
  const pct = (p) => {
    let acc = 0
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v }
    return 255
  }
  return { median: Math.max(1, pct(0.5)), high: Math.max(1, pct(0.85)) }
}

// The photos only show the front. Build a believable back from the same fabric:
// a masked blur keeps the garment's colour and large-scale lighting but drops front-only
// details (neck opening, drawstrings, pocket), then a fine grain restores the fabric texture.
function synthBack(photo, alpha) {
  const N = TEX_W * TEX_H
  const { median } = fabricLevels(photo, alpha)
  // two masked blurs: a light one keeps the folds but softens seams and drawstrings,
  // a heavy one fills the big gaps (the neck hole) where the light one has no fabric to sample
  const maskedBlur = (radius, passes) => {
    const w = new Float32Array(N)
    const ch = [new Float32Array(N), new Float32Array(N), new Float32Array(N)]
    for (let i = 0; i < N; i++) {
      const o = i * 4
      // skip the dark inside-of-the-garment areas (neck hole, hood lining)
      const keep = alpha[i] > 127 && lumAt(photo.data, o) > median * 0.62 ? 1 : 0
      w[i] = keep
      for (let c = 0; c < 3; c++) ch[c][i] = photo.data[o + c] * keep
    }
    for (const plane of [w, ...ch]) for (let pass = 0; pass < passes; pass++) boxBlur(plane, TEX_W, TEX_H, radius)
    return { w, ch }
  }
  // dark fleece hides its folds anyway, so smooth harder to lose the pocket and drawstrings
  const fine = median > 100 ? maskedBlur(4, 2) : maskedBlur(9, 3)
  const coarse = maskedBlur(22, 3)
  const out = new ImageData(TEX_W, TEX_H)
  let seed = 1234567
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const grainAmount = median > 100 ? 7 : 6
  for (let i = 0; i < N; i++) {
    const o = i * 4
    const grain = (rand() - 0.5) * grainAmount
    const t = Math.min(1, fine.w[i] / 0.6)
    for (let c = 0; c < 3; c++) {
      const vf = fine.w[i] > 0.01 ? fine.ch[c][i] / fine.w[i] : 0
      const vc = coarse.w[i] > 0.01 ? coarse.ch[c][i] / coarse.w[i] : photo.data[o + c]
      out.data[o + c] = Math.max(0, Math.min(255, t * vf + (1 - t) * vc + grain))
    }
    out.data[o + 3] = 255
  }
  // skipping the darkest pixels lifts the average; match the front's typical brightness again
  const k = median / fabricLevels(out, alpha).median
  if (k < 0.98 || k > 1.02) {
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) out.data[i * 4 + c] = Math.min(255, out.data[i * 4 + c] * k)
  }
  return out
}

// High-pass of the fabric for the bump map, so folds and weave catch the lights.
function bumpCanvas(photo, alpha, mirror) {
  const N = TEX_W * TEX_H
  const lum = new Float32Array(N)
  for (let i = 0; i < N; i++) lum[i] = lumAt(photo.data, i * 4)
  const low = boxBlur(boxBlur(Float32Array.from(lum), TEX_W, TEX_H, 6), TEX_W, TEX_H, 6)
  const c = document.createElement('canvas')
  c.width = TEX_W; c.height = TEX_H
  const out = new ImageData(TEX_W, TEX_H)
  for (let y = 0; y < TEX_H; y++) {
    for (let x = 0; x < TEX_W; x++) {
      const src = y * TEX_W + (mirror ? TEX_W - 1 - x : x)
      const o = (y * TEX_W + x) * 4
      const v = alpha[src] > 127 ? Math.max(0, Math.min(255, 128 + (lum[src] - low[src]) * 1.6)) : 128
      out.data[o] = out.data[o + 1] = out.data[o + 2] = v
      out.data[o + 3] = 255
    }
  }
  c.getContext('2d').putImageData(out, 0, 0)
  return c
}

// How lit the fabric is at each point (1 = fully lit). Multiplied over the printed design
// so ink sits in the folds and shadows instead of floating on top like a sticker.
function shadingCanvas(photo, alpha, mirror) {
  const N = TEX_W * TEX_H
  const { high } = fabricLevels(photo, alpha)
  const lum = new Float32Array(N)
  for (let i = 0; i < N; i++) lum[i] = lumAt(photo.data, i * 4)
  boxBlur(lum, TEX_W, TEX_H, 2)
  const c = document.createElement('canvas')
  c.width = TEX_W; c.height = TEX_H
  const out = new ImageData(TEX_W, TEX_H)
  for (let y = 0; y < TEX_H; y++) {
    for (let x = 0; x < TEX_W; x++) {
      const src = y * TEX_W + (mirror ? TEX_W - 1 - x : x)
      const o = (y * TEX_W + x) * 4
      const s = Math.max(0.45, Math.min(1, lum[src] / high))
      out.data[o] = out.data[o + 1] = out.data[o + 2] = s * 255
      out.data[o + 3] = 255
    }
  }
  c.getContext('2d').putImageData(out, 0, 0)
  return c
}

const shapes = new Map()
function loadShape(src) {
  if (!shapes.has(src)) {
    const maskSrc = src.replace(/\.\w+$/, '-mask.png')
    shapes.set(src, Promise.all([loadImage(src), loadImage(maskSrc)]).then(([img, maskImg]) => {
      const c = document.createElement('canvas')
      c.width = TEX_W; c.height = TEX_H
      const ctx = c.getContext('2d', { willReadFrequently: true })
      // draw like "object-fit: cover" into the texture-sized canvas
      const cover = (im) => {
        const s = Math.max(TEX_W / im.width, TEX_H / im.height)
        ctx.clearRect(0, 0, TEX_W, TEX_H)
        ctx.drawImage(im, (TEX_W - im.width * s) / 2, (TEX_H - im.height * s) / 2, im.width * s, im.height * s)
        return ctx.getImageData(0, 0, TEX_W, TEX_H)
      }
      const photo = cover(img)
      const maskData = cover(maskImg).data
      const alpha = new Uint8Array(TEX_W * TEX_H)
      const keep = new Uint8Array(TEX_W * TEX_H)
      for (let i = 0; i < alpha.length; i++) {
        alpha[i] = maskData[i * 4]
        keep[i] = alpha[i] > 127 ? 1 : 0
      }
      const backPhoto = synthBack(photo, alpha)
      return {
        photo, backPhoto, masks: maskCanvases(alpha),
        bumps: { front: bumpCanvas(photo, alpha, false), back: bumpCanvas(backPhoto, alpha, true) },
        shading: { front: shadingCanvas(photo, alpha, false), back: shadingCanvas(backPhoto, alpha, true) },
        geometry: buildGeometry(keep), tinted: new Map(),
      }
    }))
  }
  return shapes.get(src)
}

/* ---------- texture composition ---------- */

function tintedPhoto(shape, color, side) {
  const key = `${side}|${color.bright || 1}|${color.tint}`
  if (!shape.tinted.has(key)) {
    // brighten (for the dark hoodie) then multiply by the tint, like the old CSS filter + multiply
    const b = color.bright || 1
    const src = (side === 'back' ? shape.backPhoto : shape.photo).data
    const out = new ImageData(TEX_W, TEX_H)
    const tr = (parseInt(color.tint.slice(1, 3), 16) / 255) * b
    const tg = (parseInt(color.tint.slice(3, 5), 16) / 255) * b
    const tb = (parseInt(color.tint.slice(5, 7), 16) / 255) * b
    for (let i = 0; i < src.length; i += 4) {
      out.data[i] = Math.min(255, src[i] * tr)
      out.data[i + 1] = Math.min(255, src[i + 1] * tg)
      out.data[i + 2] = Math.min(255, src[i + 2] * tb)
      out.data[i + 3] = 255
    }
    const c = document.createElement('canvas')
    c.width = TEX_W; c.height = TEX_H
    c.getContext('2d').putImageData(out, 0, 0)
    shape.tinted.set(key, c)
  }
  return shape.tinted.get(key)
}

const layerImages = new Map()
function layerImage(src, onReady) {
  let entry = layerImages.get(src)
  if (!entry) {
    entry = { img: new Image(), ready: false, waiters: [] }
    entry.img.onload = () => { entry.ready = true; entry.waiters.forEach((f) => f()); entry.waiters = [] }
    entry.img.src = src
    layerImages.set(src, entry)
  }
  if (!entry.ready) entry.waiters.push(onReady)
  return entry.ready ? entry.img : null
}

function drawLayers(ctx, layers, print, onAsset) {
  const pct = (v) => parseFloat(v) / 100
  const px = pct(print.left) * TEX_W, py = pct(print.top) * TEX_H
  const pw = pct(print.width) * TEX_W, ph = pct(print.height) * TEX_H
  for (const l of layers) {
    ctx.save()
    ctx.translate(px + (l.x / 100) * pw, py + (l.y / 100) * ph)
    ctx.rotate(rad(l.rotate))
    if (l.type === 'text') {
      const font = `${l.font.weight} ${0.16 * pw * l.scale}px ${l.font.family}`
      if (!document.fonts.check(font)) document.fonts.load(font).then(onAsset)
      ctx.font = font
      ctx.fillStyle = l.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(l.text.toUpperCase(), 0, 0)
    } else if (l.type === 'clip') {
      const s = 0.45 * pw * l.scale
      ctx.translate(-s / 2, -s / 2)
      ctx.scale(s / 24, s / 24)
      ctx.fillStyle = l.color
      ctx.fill(new Path2D(l.d))
    } else {
      const img = layerImage(l.src, onAsset)
      if (img) {
        const w = 0.7 * pw * l.scale
        const h = w * (img.naturalHeight / img.naturalWidth || 1)
        ctx.drawImage(img, -w / 2, -h / 2, w, h)
      }
    }
    ctx.restore()
  }
}

const scratchCanvases = []
const scratch = (i) => {
  if (!scratchCanvases[i]) {
    scratchCanvases[i] = document.createElement('canvas')
    scratchCanvases[i].width = TEX_W
    scratchCanvases[i].height = TEX_H
  }
  return scratchCanvases[i]
}

function compose(canvas, shape, color, layers, print, side, onAsset) {
  const ctx = canvas.getContext('2d')
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, TEX_W, TEX_H)
  const photo = tintedPhoto(shape, color, side)
  if (side === 'back') {
    ctx.save(); ctx.translate(TEX_W, 0); ctx.scale(-1, 1); ctx.drawImage(photo, 0, 0); ctx.restore()
  } else {
    ctx.drawImage(photo, 0, 0)
  }
  const sideLayers = layers.filter((l) => l.side === side)
  if (sideLayers.length) {
    // print the design on its own sheet, darken it where the fabric is in shadow, then lay it down
    const ink = scratch(0), shaded = scratch(1)
    const ictx = ink.getContext('2d'), sctx = shaded.getContext('2d')
    ictx.clearRect(0, 0, TEX_W, TEX_H)
    drawLayers(ictx, sideLayers, print, onAsset)
    sctx.globalCompositeOperation = 'source-over'
    sctx.clearRect(0, 0, TEX_W, TEX_H)
    sctx.drawImage(ink, 0, 0)
    sctx.globalCompositeOperation = 'multiply'
    sctx.drawImage(shape.shading[side], 0, 0)
    sctx.globalCompositeOperation = 'destination-in'
    sctx.drawImage(ink, 0, 0)
    sctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(shaded, 0, 0)
  }
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(shape.masks[side], 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

/* ---------- component ---------- */

export default function Garment3D({
  product, color, layers, angle, immediate = false, autoRotate = false, showcase = false,
  onSettle, onThumbs, thumbAngles, onPrintRect,
}) {
  const hostRef = useRef(null)
  const three = useRef(null)
  const live = useRef({})
  live.current = { angle, immediate, autoRotate, showcase, onSettle }
  const [shape, setShape] = useState(null)
  const [assetTick, setAssetTick] = useState(0)

  useEffect(() => {
    let on = true
    loadShape(product.img).then((s) => on && setShape(s))
    return () => { on = false }
  }, [product.img])

  // the print area sits on the bulged chest, slightly nearer the camera than the photo plane
  useEffect(() => {
    if (!onPrintRect) return
    const scale = (v, size) => 50 + (parseFloat(v) + parseFloat(size) / 2 - 50) * OVERLAY_SCALE - (parseFloat(size) * OVERLAY_SCALE) / 2
    const p = product.print
    onPrintRect({
      left: `${scale(p.left, p.width)}%`, top: `${scale(p.top, p.height)}%`,
      width: `${parseFloat(p.width) * OVERLAY_SCALE}%`, height: `${parseFloat(p.height) * OVERLAY_SCALE}%`,
    })
  }, [product.print])

  // one-time three.js setup
  useEffect(() => {
    const host = hostRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV, TEX_W / TEX_H, 0.1, 20)
    if (showcase) {
      // look slightly down onto the garment so the floor shadow reads
      camera.position.set(0, 0.24, CAM_DIST * 1.1)
      camera.lookAt(0, -0.035, 0)
    } else {
      // straight on, so the HTML print-area overlay lines up with the texture
      camera.position.set(0, 0, CAM_DIST)
    }

    // three.js lights are physical: ~PI total irradiance reproduces the photo's own brightness head-on
    // soft studio-room reflections so light wraps around the fabric; flat ambient fills the rest
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap
    scene.environmentIntensity = 0.3
    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(1.4, 1.6, 3)
    const fill = new THREE.DirectionalLight(0xdfe6ff, 0.55)
    fill.position.set(-2.2, 0.4, 1.4)
    const rim = new THREE.DirectionalLight(0xffffff, 1.0)
    rim.position.set(-0.6, 1.2, -3)
    scene.add(key, fill, rim)

    const textures = ['front', 'back'].map(() => {
      const c = document.createElement('canvas')
      c.width = TEX_W; c.height = TEX_H
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = renderer.capabilities.getMaxAnisotropy()
      return t
    })
    const bumpMaps = ['front', 'back'].map(() => new THREE.CanvasTexture(document.createElement('canvas')))
    const materials = textures.map((map, i) => new THREE.MeshPhysicalMaterial({
      map, bumpMap: bumpMaps[i], bumpScale: 1.4,
      side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.92, metalness: 0,
      specularIntensity: 0.25, // cotton barely reflects; keeps dark colours rich
      // soft cloth sheen at grazing angles
      sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.09, 0.09, 0.1),
    }))
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materials)
    const pivot = new THREE.Group()
    pivot.add(mesh)

    // contact shadow on the floor, turning with the garment
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 256
    const sctx = shadowCanvas.getContext('2d')
    const grad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(0,0,0,0.75)')
    grad.addColorStop(0.45, 'rgba(0,0,0,0.4)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 256, 256)
    const shadowTex = new THREE.CanvasTexture(shadowCanvas)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_W * 1.05, DEPTH * 5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.visible = showcase
    pivot.add(shadow)
    scene.add(pivot)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      st.dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const st = {
      renderer, scene, camera, pivot, mesh, shadow, textures, bumpMaps,
      dirty: true, current: live.current.angle, spin: 0, sway: 0, settled: true,
    }
    three.current = st
    resize()

    let raf, last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { angle: target, immediate: imm, autoRotate: auto, showcase: show, onSettle: settleCb } = live.current
      if (imm) st.current = target
      else st.current += (target - st.current) * (1 - Math.exp(-dt * 9))
      if (auto) st.spin += dt * 22
      // a slow, gentle sway while idle; eases out while the user drags
      st.sway += dt
      const swayAmount = show && !imm ? Math.sin(st.sway * 0.8) * 4 : 0
      const moving = Math.abs(target - st.current) > 0.05
      if (moving || auto || show || st.dirty) {
        pivot.rotation.y = rad(st.current + st.spin + swayAmount)
        renderer.render(scene, camera)
        st.dirty = false
      }
      const settled = !imm && Math.abs(target - st.current) < 0.6
      if (settled !== st.settled) { st.settled = settled; settleCb?.(settled) }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      textures.forEach((t) => t.dispose())
      bumpMaps.forEach((t) => t.dispose())
      materials.forEach((m) => m.dispose())
      shadowTex.dispose()
      shadow.geometry.dispose()
      shadow.material.dispose()
      envMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      three.current = null
    }
  }, [])

  useEffect(() => {
    const st = three.current
    if (!st || !shape) return
    st.mesh.geometry = shape.geometry
    st.shadow.position.y = shape.geometry.userData.hemY - 0.004
    ;['front', 'back'].forEach((side, i) => {
      st.bumpMaps[i].image = shape.bumps[side]
      st.bumpMaps[i].needsUpdate = true
    })
    st.dirty = true
  }, [shape])

  // repaint the printed textures whenever the colour or design changes
  useEffect(() => {
    const st = three.current
    if (!st || !shape) return
    const bump = () => setAssetTick((t) => t + 1)
    ;['front', 'back'].forEach((side, i) => {
      compose(st.textures[i].image, shape, color, layers, product.print, side, bump)
      st.textures[i].needsUpdate = true
    })
    st.dirty = true
  }, [shape, color, layers, product.print, assetTick])

  // static snapshots for the view thumbnails
  useEffect(() => {
    const st = three.current
    if (!st || !shape || !onThumbs || !thumbAngles) return
    const id = setTimeout(() => {
      const { renderer, scene, camera, pivot } = st
      const thumb = document.createElement('canvas')
      thumb.width = 300; thumb.height = 352
      const tctx = thumb.getContext('2d')
      const urls = thumbAngles.map((a) => {
        pivot.rotation.y = rad(a)
        renderer.render(scene, camera)
        tctx.clearRect(0, 0, thumb.width, thumb.height)
        tctx.drawImage(renderer.domElement, 0, 0, thumb.width, thumb.height)
        try { return thumb.toDataURL('image/png') } catch { return '' }
      })
      st.dirty = true
      onThumbs(urls)
    }, 180)
    return () => clearTimeout(id)
  }, [shape, color, layers, product.print, assetTick, thumbAngles?.join()])

  return <div ref={hostRef} className="g3d" />
}
