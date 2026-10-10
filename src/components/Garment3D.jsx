import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// Texture canvas size — matches the stage's 410:480 aspect ratio.
export const TEX_W = 820
export const TEX_H = 960
const GRID_W = 120
const GRID_H = 140
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
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex([...front, ...back])
  geo.addGroup(0, front.length, 0)
  geo.addGroup(front.length, back.length, 1)
  geo.computeVertexNormals()
  return geo
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
      return { photo, masks: maskCanvases(alpha), geometry: buildGeometry(keep), tinted: new Map() }
    }))
  }
  return shapes.get(src)
}

/* ---------- texture composition ---------- */

function tintedPhoto(shape, color) {
  const key = `${color.bright || 1}|${color.tint}`
  if (!shape.tinted.has(key)) {
    // brighten (for the dark hoodie) then multiply by the tint, like the old CSS filter + multiply
    const b = color.bright || 1
    const src = shape.photo.data
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

function compose(canvas, shape, color, layers, print, side, onAsset) {
  const ctx = canvas.getContext('2d')
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, TEX_W, TEX_H)
  const photo = tintedPhoto(shape, color)
  if (side === 'back') {
    ctx.save(); ctx.translate(TEX_W, 0); ctx.scale(-1, 1); ctx.drawImage(photo, 0, 0); ctx.restore()
  } else {
    ctx.drawImage(photo, 0, 0)
  }
  drawLayers(ctx, layers.filter((l) => l.side === side), print, onAsset)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(shape.masks[side], 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

/* ---------- component ---------- */

export default function Garment3D({
  product, color, layers, angle, immediate = false, autoRotate = false, onSettle, onThumbs, thumbAngles,
}) {
  const hostRef = useRef(null)
  const three = useRef(null)
  const live = useRef({})
  live.current = { angle, immediate, autoRotate, onSettle }
  const [shape, setShape] = useState(null)
  const [assetTick, setAssetTick] = useState(0)

  useEffect(() => {
    let on = true
    loadShape(product.img).then((s) => on && setShape(s))
    return () => { on = false }
  }, [product.img])

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
    camera.position.set(0, 0, CAM_DIST)

    // three.js lights are physical: ~PI total irradiance reproduces the photo's own brightness head-on
    scene.add(new THREE.AmbientLight(0xffffff, 1.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(1.4, 1.6, 3)
    const fill = new THREE.DirectionalLight(0xdfe6ff, 0.55)
    fill.position.set(-2.2, 0.4, 1.4)
    const rim = new THREE.DirectionalLight(0xffffff, 1.4)
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
    const materials = textures.map((map) => new THREE.MeshStandardMaterial({
      map, side: THREE.DoubleSide, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.95, metalness: 0,
    }))
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materials)
    const pivot = new THREE.Group()
    pivot.add(mesh)
    scene.add(pivot)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      st.dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const st = { renderer, scene, camera, pivot, mesh, textures, dirty: true, current: live.current.angle, spin: 0, settled: true }
    three.current = st
    resize()

    let raf, last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const { angle: target, immediate: imm, autoRotate: auto, onSettle: settleCb } = live.current
      if (imm) st.current = target
      else st.current += (target - st.current) * (1 - Math.exp(-dt * 9))
      if (auto) st.spin += dt * 22
      const moving = Math.abs(target - st.current) > 0.05
      if (moving || auto || st.dirty) {
        pivot.rotation.y = rad(st.current + st.spin)
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
      materials.forEach((m) => m.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      three.current = null
    }
  }, [])

  useEffect(() => {
    const st = three.current
    if (!st || !shape) return
    st.mesh.geometry = shape.geometry
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
      thumb.width = 164; thumb.height = 192
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
