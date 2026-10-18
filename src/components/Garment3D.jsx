import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/* ---------- patterns ---------- */
// Garments are modelled in code (roughly metres). The body texture holds a straight-on view of
// the front (left half) and back (right half), so a print's x/y on the garment maps 1:1 to pixels.

const W_REF = 0.34
const Y_MIN = -0.62
const Y_MAX = 0.42
const PX = 1600 // texture pixels per unit
const TEX_W = Math.round(4 * W_REF * PX)
const TEX_H = Math.round((Y_MAX - Y_MIN) * PX)
const FOV = 22
const STAGE_ASPECT = 410 / 480

const MODELS = {
  tshirt: {
    hem: -0.45, shoulder: 0.17, neckRise: 0.085,
    width: [[0, 0.236], [0.35, 0.231], [0.72, 0.244], [1, 0.248]],
    depthFront: [[0, 0.084], [0.6, 0.104], [1, 0.098]],
    depthBack: [[0, 0.082], [0.6, 0.092], [1, 0.092]],
    neck: { w: 0.082, d: 0.068, frontDrop: 0.05 },
    folds: 1.7,
    sleeve: { base: [0.181, 0.106, 0], dir: [0.74, -0.67, 0], back: 0.05, length: 0.27, ra: [0.08, 0.07], rb: [0.058, 0.048] },
    collar: 0.0075,
    print: { x0: -0.115, x1: 0.115, y0: -0.13, y1: 0.165 },
  },
  hoodie: {
    hem: -0.55, band: 0.07, shoulder: 0.16, neckRise: 0.06,
    width: [[0, 0.232], [0.09, 0.24], [0.15, 0.272], [0.5, 0.277], [1, 0.28]],
    depthFront: [[0, 0.1], [0.5, 0.125], [1, 0.115]],
    depthBack: [[0, 0.098], [0.5, 0.11], [1, 0.108]],
    neck: { w: 0.1, d: 0.082, frontDrop: 0.02 },
    folds: 2,
    // drop shoulders, full sleeves hanging beside the body, bunching above wide ribbed cuffs
    sleeve: { bend: { center: [0.15, -0.035], radius: 0.15, endAngle: 0.1 }, back: 0.07, length: 0.68, ra: [0.09, 0.075], rb: [0.085, 0.068], cuff: 0.07, cuffScale: 0.78, bunch: 0.045 },
    hood: { center: [0, 0.245, -0.035], radii: [0.215, 0.125, 0.175], facing: [0, 0.96, 0.28], open: 0.5, vee: 1.15, bottom: 2.75, rim: 0.016 },
    strings: { spread: 0.035, end: 0.0 },
    pocket: { top: -0.19, bottom: -0.47, topHalf: 0.135, bottomHalf: 0.17 },
    print: { x0: -0.11, x1: 0.11, y0: -0.15, y1: 0.12 },
  },
}

const rad = (d) => (d * Math.PI) / 180
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e)
function table(rows, t) {
  for (let i = 1; i < rows.length; i++) {
    if (t <= rows[i][0]) {
      const [t0, v0] = rows[i - 1], [t1, v1] = rows[i]
      const k = (t - t0) / (t1 - t0)
      return v0 + (v1 - v0) * k * k * (3 - 2 * k)
    }
  }
  return rows[rows.length - 1][1]
}

function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const f = (v) => v * v * (3 - 2 * v)
  const u = f(x - xi), v = f(y - yi), w = f(z - zi)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz)
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w,
  )
}

// Soft drape: vertical folds in the lower body, diagonal pulls from the armpits, slight irregularity.
function foldAt(m, x, y, z) {
  const k = m.folds
  const side = Math.abs(x)
  let d = 0.0035 * k * smoothstep(0.05, -0.3, y) * Math.sin(x * 34 + Math.sin(y * 7) * 1.6 + (z < 0 ? 1.7 : 0))
  d += 0.003 * k * Math.exp(-(((y - (m.shoulder - 0.17)) / 0.09) ** 2)) * smoothstep(0.1, 0.23, side) * Math.sin(side * 42 + y * 30)
  d += 0.0028 * k * (vnoise(x * 9 + 3, y * 6, z * 9) - 0.5)
  d += 0.005 * k * (vnoise(x * 3.5 + 11, y * 2.5, z * 3.5) - 0.5) * smoothstep(0.15, -0.2, y)
  if (m.band) d -= 0.004 * smoothstep(m.hem + m.band + 0.05, m.hem + m.band, y) * (0.5 + 0.5 * Math.sin(x * 60))
  return d
}

/* ---------- surface helpers ---------- */

// A rows x cols grid of points; columns wrap when `wrap`. Normals point away from outward(r, c, p).
function gridSurface(rows, cols, at, outward, wrap = true) {
  const P = new Float32Array(rows * cols * 3)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) P.set(at(r, c), (r * cols + c) * 3)
  const N = new Float32Array(rows * cols * 3)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3(), p = new THREE.Vector3()
  const get = (v, r, c) => v.fromArray(P, (r * cols + c) * 3)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cp = wrap ? (c + 1) % cols : Math.min(cols - 1, c + 1)
      const cm = wrap ? (c - 1 + cols) % cols : Math.max(0, c - 1)
      const du = get(a, r, cp).sub(get(n, r, cm))
      const dv = get(b, Math.min(rows - 1, r + 1), c).sub(get(n, Math.max(0, r - 1), c))
      n.crossVectors(du, dv).normalize()
      get(p, r, c)
      if (n.dot(outward(r, c, p)) < 0) n.negate()
      n.toArray(N, (r * cols + c) * 3)
    }
  }
  return { P, N, rows, cols, wrap }
}

// Geometry from column ranges [c0, c1] of a grid (c1 may equal cols to close a wrapped seam).
function gridGeometry(surf, ranges, uvAt) {
  const { P, N, rows, cols } = surf
  const pos = [], nrm = [], uv = [], idx = []
  for (const [c0, c1] of ranges) {
    const base = pos.length / 3
    const w = c1 - c0 + 1
    for (let r = 0; r < rows; r++) {
      for (let c = c0; c <= c1; c++) {
        const o = (r * cols + (c % cols)) * 3
        pos.push(P[o], P[o + 1], P[o + 2])
        nrm.push(N[o], N[o + 1], N[o + 2])
        uv.push(...uvAt(P[o], P[o + 1], P[o + 2], r, c))
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < w - 1; c++) {
        const a = base + r * w + c, b = a + 1, cc = a + w, d = cc + 1
        idx.push(a, b, cc, b, d, cc)
      }
    }
  }
  // make the winding agree with the outward normals
  const i0 = idx[0] * 3, i1 = idx[1] * 3, i2 = idx[2] * 3
  const e1 = new THREE.Vector3(pos[i1] - pos[i0], pos[i1 + 1] - pos[i0 + 1], pos[i1 + 2] - pos[i0 + 2])
  const e2 = new THREE.Vector3(pos[i2] - pos[i0], pos[i2 + 1] - pos[i0 + 1], pos[i2 + 2] - pos[i0 + 2])
  const face = e1.cross(e2)
  if (face.dot(new THREE.Vector3(nrm[i0], nrm[i0 + 1], nrm[i0 + 2])) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

const ringPoints = (surf, r) => {
  const pts = []
  for (let c = 0; c < surf.cols; c++) pts.push(new THREE.Vector3().fromArray(surf.P, (r * surf.cols + c) * 3))
  return pts
}

/* ---------- garment parts ---------- */

const SEG = 128
const TILE = 0.16 // world size of one repeat of the knit textures

function buildBody(m) {
  const rings = []
  const NB = 72
  for (let i = 0; i <= NB; i++) {
    const t = i / NB
    rings.push({ y: m.hem + (m.shoulder - m.hem) * t, w: table(m.width, t), df: table(m.depthFront, t), db: table(m.depthBack, t), a: 0, t })
  }
  // sloped shoulders: rounded at the shoulder point, then a straight ~20 degree run to the neckline
  const top = rings[NB]
  const NS = 24
  for (let i = 1; i <= NS; i++) {
    const k = i / NS
    const keep = 1 - k
    rings.push({
      y: m.shoulder + m.neckRise * (0.3 * (1 - keep ** 4) + 0.7 * k),
      w: m.neck.w + (top.w - m.neck.w) * keep,
      df: m.neck.d + (top.df - m.neck.d) * Math.pow(keep, 0.7),
      db: m.neck.d + (top.db - m.neck.d) * Math.pow(keep, 0.7),
      a: k, t: 1,
    })
  }
  const surf = gridSurface(rings.length, SEG, (r, c) => {
    const R = rings[r]
    const phi = (c / SEG) * Math.PI * 2
    const cs = Math.cos(phi), sn = Math.sin(phi)
    const depth = sn >= 0 ? R.df : R.db
    // boxy knit body, round neckline
    const E = 2 / (2.5 - 0.5 * smoothstep(0.3, 1, R.a))
    const x = -R.w * spow(cs, E)
    const z = depth * spow(sn, E)
    const y = R.y - m.neck.frontDrop * smoothstep(0.45, 1, R.a) * Math.max(0, sn) ** 2
    const d = foldAt(m, x, y, z) * (1 - smoothstep(0.35, 0.9, R.a))
    const nx = x / R.w, nz = z / depth
    const len = Math.hypot(nx, nz) || 1
    return [x + (d * nx) / len, y, z + (d * nz) / len]
  }, (r, c, p) => new THREE.Vector3(p.x, 0, p.z))
  const geo = gridGeometry(surf, [[0, SEG / 2], [SEG / 2, SEG]], (x, y, z, r, c) => [
    c <= SEG / 2 ? 0.25 + x / (4 * W_REF) : 0.75 - x / (4 * W_REF),
    (y - Y_MIN) / (Y_MAX - Y_MIN),
  ])
  return { geo, surf, rings }
}

function buildSleeve(m) {
  const s = m.sleeve
  const Z = new THREE.Vector3(0, 0, 1)
  // Axis of the sleeve. Straight sleeves run from `base` along `dir`. Drop-shoulder sleeves
  // (`bend`) leave the shoulder sideways, curve over a wide arc and then hang down, so the
  // shoulder line runs smoothly into the arm.
  const axis = (sv) => {
    if (!s.bend) {
      const T = new THREE.Vector3(...s.dir).normalize()
      return { c: new THREE.Vector3(...s.base).addScaledVector(T, sv), T }
    }
    const { center: [cx, cy], radius: R, endAngle } = s.bend
    const arcLen = R * (Math.PI / 2 - endAngle)
    if (sv <= 0) return { c: new THREE.Vector3(cx + sv, cy + R, 0), T: new THREE.Vector3(1, 0, 0) }
    if (sv <= arcLen) {
      const a = Math.PI / 2 - sv / R
      return { c: new THREE.Vector3(cx + R * Math.cos(a), cy + R * Math.sin(a), 0), T: new THREE.Vector3(Math.sin(a), -Math.cos(a), 0) }
    }
    const T = new THREE.Vector3(Math.sin(endAngle), -Math.cos(endAngle), 0)
    const end = new THREE.Vector3(cx + R * Math.cos(endAngle), cy + R * Math.sin(endAngle), 0)
    return { c: end.addScaledVector(T, sv - arcLen), T }
  }
  const frame = (sv) => {
    const { c, T } = axis(sv)
    const N = Z.clone().cross(T).normalize()
    return { c, T, N, B: new THREE.Vector3().crossVectors(T, N) }
  }
  const center = (sv) => axis(sv).c
  const s0 = -s.back, s1 = s.length
  const ROWS = 40, COLS = 56
  const radii = (sv) => {
    const k = Math.max(0, sv) / s.length
    return [s.ra[0] + (s.ra[1] - s.ra[0]) * k, s.rb[0] + (s.rb[1] - s.rb[0]) * k]
  }
  const svAt = (r) => s0 + ((s1 - s0) * r) / (ROWS - 1)
  const surf = gridSurface(ROWS, COLS, (r, c) => {
    const sv = svAt(r)
    const th = (c / COLS) * Math.PI * 2
    const [ra, rb] = radii(sv)
    // creases around the elbow / underarm
    const crease = 1 + 0.03 * m.folds * Math.sin(th * 3 + sv * 30) * smoothstep(0, 0.1, sv)
      + 0.03 * m.folds * (vnoise(Math.cos(th) * 2 + 5, Math.sin(th) * 2, sv * 12) - 0.5)
      + (s.bunch || 0) * Math.sin(sv * 70 + Math.cos(th) * 1.5) * smoothstep(s.length * 0.5, s.length * 0.95, sv)
    // gather into the cuff
    const taper = s.cuffScale ? 1 - (1 - s.cuffScale * 1.03) * smoothstep(s.length * 0.82, s.length, sv) : 1
    const { c: ctr, N, B } = frame(sv)
    const p = ctr.addScaledVector(N, ra * crease * taper * Math.cos(th)).addScaledVector(B, rb * crease * taper * Math.sin(th))
    return [p.x, p.y, p.z]
  }, (r, c, p) => p.clone().sub(center(svAt(r))))
  const circ = Math.PI * (s.ra[0] + s.rb[0])
  const geo = gridGeometry(surf, [[0, COLS]], (x, y, z, r, c) => [((c / COLS) * circ) / TILE, (svAt(r) - s0) / TILE])
  // round cap where the sleeve meets the shoulder, so its start never shows as an open tube
  let cap = null
  if (!s.bend) {
    const { N, T, B } = frame(s0)
    cap = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    cap.scale(s.ra[0] * 0.96, s.back * 0.5, s.rb[0] * 0.96)
    cap.applyMatrix4(new THREE.Matrix4().makeBasis(N, T.clone().negate(), B).setPosition(center(s0)))
  }
  const end = ringPoints(surf, ROWS - 1)
  let cuff = null
  if (s.cuff) {
    const [ra, rb] = radii(s.length)
    const cuffSurf = gridSurface(8, COLS, (r, c) => {
      const sv = s.length - 0.01 + ((s.cuff + 0.01) * r) / 7
      const th = (c / COLS) * Math.PI * 2
      const k = s.cuffScale || 0.9
      const { c: ctr, N, B } = frame(sv)
      const p = ctr.addScaledVector(N, ra * k * Math.cos(th)).addScaledVector(B, rb * k * Math.sin(th))
      return [p.x, p.y, p.z]
    }, () => new THREE.Vector3(), true)
    // outward for the cuff: away from the sleeve axis
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < COLS; c++) {
        const o = (r * COLS + c) * 3
        const p = new THREE.Vector3().fromArray(cuffSurf.P, o)
        const n = new THREE.Vector3().fromArray(cuffSurf.N, o)
        if (n.dot(p.sub(center(s.length))) < 0) n.negate().toArray(cuffSurf.N, o)
      }
    }
    cuff = { geo: gridGeometry(cuffSurf, [[0, COLS]], (x, y, z, r, c) => [c / COLS, r / 7]), end: ringPoints(cuffSurf, 7) }
  }
  return { geo, cap, end, cuff }
}

// A hood worn "down but full", like a folded product shot: a soft dome around the neck whose
// opening faces up and forwards and narrows into a V at the front, where the two edges meet.
function buildHood(m) {
  const h = m.hood
  const center = new THREE.Vector3(...h.center)
  const [rx, ry, rz] = h.radii
  const A = new THREE.Vector3(...h.facing).normalize() // the way the opening faces
  const U = new THREE.Vector3(1, 0, 0)
  const V = new THREE.Vector3().crossVectors(A, U).normalize() // up-back; -V is down-front
  const ROWS = 40, COLS = 96
  // opening radius around A, stretched towards the front so the edges meet in a V at the neck
  const openAt = (ph) => h.open + h.vee * Math.max(0, -Math.sin(ph)) ** 3
  const point = (th, ph, sag = 0) => {
    const d = A.clone().multiplyScalar(Math.cos(th))
      .addScaledVector(U, Math.sin(th) * Math.cos(ph))
      .addScaledVector(V, Math.sin(th) * Math.sin(ph))
    // soft fabric: a little irregular bulge so it doesn't read as a shell
    const bulge = 1 + sag * (vnoise(d.x * 3 + 7, d.y * 3, d.z * 3) - 0.5)
    return new THREE.Vector3(center.x + d.x * rx * bulge, center.y + d.y * ry * bulge, center.z + d.z * rz * bulge)
  }
  const thAt = (r, ph) => openAt(ph) + ((h.bottom - openAt(ph)) * r) / (ROWS - 1)
  const surf = gridSurface(ROWS, COLS, (r, c) => {
    const ph = (c / COLS) * Math.PI * 2
    const p = point(thAt(r, ph), ph, 0.12)
    return [p.x, p.y, p.z]
  }, (r, c, p) => p.clone().sub(center))
  const geo = gridGeometry(surf, [[0, COLS]], (x, y, z, r, c) => [
    ((c / COLS) * Math.PI * 2 * rx) / TILE, ((r / (ROWS - 1)) * Math.PI * ry) / TILE,
  ])
  // thick rolled edge around the opening
  const rimPts = []
  for (let c = 0; c < COLS; c++) {
    const ph = (c / COLS) * Math.PI * 2
    rimPts.push(point(openAt(ph) + 0.03, ph, 0.12))
  }
  const rimGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 220, h.rim, 12, true)
  // where the drawstrings come out: either side of the V
  const eyelet = (side) => {
    const ph = -Math.PI / 2 + side * 0.32
    return point(openAt(ph) + 0.06, ph, 0.12)
  }
  return { geo, rimGeo, eyelet }
}

function buildStrings(m, hood) {
  const geos = []
  const frontZ = (y) => table(m.depthFront, (y - m.hem) / (m.shoulder - m.hem)) + 0.012
  for (const side of [-1, 1]) {
    const start = hood.eyelet(side)
    const x = side * m.strings.spread
    const pts = [
      start,
      new THREE.Vector3((start.x + x) / 2, start.y - 0.04, Math.max(start.z, frontZ(start.y - 0.04)) + 0.004),
      new THREE.Vector3(x, (start.y + m.strings.end) / 2, frontZ((start.y + m.strings.end) / 2)),
      new THREE.Vector3(x + side * 0.004, m.strings.end, frontZ(m.strings.end)),
    ]
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0045, 8, false))
    const tip = new THREE.CylinderGeometry(0.0058, 0.0058, 0.03, 12)
    tip.translate(pts[3].x, pts[3].y - 0.014, pts[3].z)
    geos.push(tip)
  }
  return geos
}

/* ---------- textures ---------- */

function noiseCanvas(w, h, amount, seed = 7) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  let s = seed
  for (let i = 0; i < w * h; i++) {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff
    const v = 128 + (s / 0x7fffffff - 0.5) * amount
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function ribCanvas() {
  const c = noiseCanvas(64, 64, 20, 3)
  const ctx = c.getContext('2d')
  for (let x = 0; x < 64; x += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(x, 0, 3, 64)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(x + 4, 0, 3, 64)
  }
  return c
}

const texX = (x, side) => (side === 'back' ? 0.75 - x / (4 * W_REF) : 0.25 + x / (4 * W_REF)) * TEX_W
const texY = (y) => (Y_MAX - y) * PX

function printRectPx(m, side) {
  const { x0, x1, y0, y1 } = m.print
  const pw = (x1 - x0) * PX
  return { left: texX((x0 + x1) / 2, side) - pw / 2, top: texY(y1), pw, ph: (y1 - y0) * PX }
}

function pocketPath(ctx, m) {
  const p = m.pocket
  const top = texY(p.top), bottom = texY(p.bottom)
  const l = (x) => texX(x, 'front')
  ctx.beginPath()
  ctx.moveTo(l(-p.topHalf), top)
  ctx.lineTo(l(p.topHalf), top)
  ctx.quadraticCurveTo(l(p.topHalf + 0.012), top + (bottom - top) * 0.55, l(p.bottomHalf), bottom - 4)
  ctx.lineTo(l(-p.bottomHalf), bottom - 4)
  ctx.quadraticCurveTo(l(-p.topHalf - 0.012), top + (bottom - top) * 0.55, l(-p.topHalf), top)
  ctx.closePath()
}

// Knit grain, hem stitching, ribbing and the hoodie pocket seams for the body.
function bodyBumpCanvas(m) {
  const c = noiseCanvas(TEX_W, TEX_H, 30)
  const ctx = c.getContext('2d')
  const stitches = (y) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 7])
    ctx.beginPath(); ctx.moveTo(0, texY(y)); ctx.lineTo(TEX_W, texY(y)); ctx.stroke()
    ctx.setLineDash([])
  }
  if (m.band) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    for (let x = 0; x < TEX_W; x += 10) ctx.fillRect(x, texY(m.hem + m.band), 4, m.band * PX)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, texY(m.hem + m.band) - 2, TEX_W, 4)
  } else {
    stitches(m.hem + 0.016)
    stitches(m.hem + 0.022)
  }
  if (m.pocket) {
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'
    ctx.lineWidth = 9
    pocketPath(ctx, m); ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([9, 7])
    ctx.save(); ctx.translate(0, 10); ctx.scale(1, 0.985); pocketPath(ctx, m); ctx.stroke(); ctx.restore()
    ctx.setLineDash([])
  }
  return c
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

// Sizes match the HTML overlay: text 16%, clipart 45%, images 70% of the print-area width.
function drawLayers(ctx, layers, rect, onAsset) {
  for (const l of layers) {
    ctx.save()
    ctx.translate(rect.left + (l.x / 100) * rect.pw, rect.top + (l.y / 100) * rect.ph)
    ctx.rotate(rad(l.rotate))
    if (l.type === 'text') {
      const font = `${l.font.weight} ${0.16 * rect.pw * l.scale}px ${l.font.family}`
      if (!document.fonts.check(font)) document.fonts.load(font).then(onAsset)
      ctx.font = font
      ctx.fillStyle = l.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(l.text.toUpperCase(), 0, 0)
    } else if (l.type === 'clip') {
      const s = 0.45 * rect.pw * l.scale
      ctx.translate(-s / 2, -s / 2)
      ctx.scale(s / 24, s / 24)
      ctx.fillStyle = l.color
      ctx.fill(new Path2D(l.d))
    } else {
      const img = layerImage(l.src, onAsset)
      if (img) {
        const w = 0.7 * rect.pw * l.scale
        const h = w * (img.naturalHeight / img.naturalWidth || 1)
        ctx.drawImage(img, -w / 2, -h / 2, w, h)
      }
    }
    ctx.restore()
  }
}

// Very dark swatches read as a black hole in 3D; lift them to a real black-fabric value.
function fabricColor(color) {
  const c = new THREE.Color(color.swatch)
  const hsl = {}
  c.getHSL(hsl)
  if (hsl.l < 0.12) c.lerp(new THREE.Color('#38383c'), 0.6)
  return c
}

function composeBody(canvas, m, fabric, layers, onAsset) {
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = `#${fabric.getHexString(THREE.SRGBColorSpace)}`
  ctx.fillRect(0, 0, TEX_W, TEX_H)
  if (m.pocket) {
    // the pocket panel catches a little less light, and its side openings fall into shadow
    const p = m.pocket
    ctx.fillStyle = 'rgba(0,0,0,0.03)'
    pocketPath(ctx, m); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 6
    pocketPath(ctx, m); ctx.stroke()
    ctx.save()
    pocketPath(ctx, m); ctx.clip()
    for (const s of [-1, 1]) {
      const edge = texX(s * p.topHalf, 'front'), inner = texX(s * (p.topHalf - 0.035), 'front')
      const g = ctx.createLinearGradient(edge, 0, inner, 0)
      g.addColorStop(0, 'rgba(0,0,0,0.14)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(Math.min(edge, inner) - 40, texY(p.top), Math.abs(edge - inner) + 80, (p.top - p.bottom) * PX)
    }
    ctx.restore()
  }
  for (const side of ['front', 'back']) {
    const sideLayers = layers.filter((l) => l.side === side)
    if (sideLayers.length) drawLayers(ctx, sideLayers, printRectPx(m, side), onAsset)
  }
}

/* ---------- assembled model ---------- */

const modelCache = new Map()
function getModel(key) {
  if (modelCache.has(key)) return modelCache.get(key)
  const m = MODELS[key]
  const body = buildBody(m)
  const sleeve = buildSleeve(m)
  const parts = { m, body, sleeve, bump: bodyBumpCanvas(m) }
  const neck = ringPoints(body.surf, body.surf.rows - 1).map((p) => new THREE.Vector3(p.x * 1.02, p.y + 0.002, p.z * 1.02))
  if (m.collar) parts.collar = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neck, true), 160, m.collar, 10, true)
  parts.hem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPoints(body.surf, 0), true), 160, 0.003, 6, true)
  const sleeveEnd = sleeve.cuff ? sleeve.cuff.end : sleeve.end
  parts.sleeveHem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sleeveEnd, true), 64, 0.0045, 6, true)
  if (m.hood) {
    parts.hood = buildHood(m)
    parts.strings = buildStrings(m, parts.hood)
  }
  modelCache.set(key, parts)
  return parts
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
  const [assetTick, setAssetTick] = useState(0)
  const modelKey = product.model

  // one-time renderer, lights and shared materials
  useEffect(() => {
    const host = hostRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 0.92
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV, STAGE_ASPECT, 0.05, 20)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap
    scene.environmentIntensity = 0.55

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(2.4, 2.1, 2.2)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, { left: -0.7, right: 0.7, top: 0.7, bottom: -0.7, near: 0.5, far: 8 })
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    const fill = new THREE.DirectionalLight(0xdfe6ff, 0.5)
    fill.position.set(-2.4, 0.6, 1.8)
    const rim = new THREE.DirectionalLight(0xffffff, 1.3)
    rim.position.set(-0.8, 1.6, -3)
    scene.add(key, fill, rim)

    const bodyCanvas = document.createElement('canvas')
    bodyCanvas.width = TEX_W; bodyCanvas.height = TEX_H
    const bodyMap = new THREE.CanvasTexture(bodyCanvas)
    bodyMap.colorSpace = THREE.SRGBColorSpace
    bodyMap.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const bodyBump = new THREE.CanvasTexture(document.createElement('canvas'))
    const knit = new THREE.CanvasTexture(noiseCanvas(256, 256, 30, 11))
    knit.wrapS = knit.wrapT = THREE.RepeatWrapping
    const rib = new THREE.CanvasTexture(ribCanvas())
    rib.wrapS = rib.wrapT = THREE.RepeatWrapping
    const collarRib = rib.clone()

    const cloth = (extra) => new THREE.MeshPhysicalMaterial({
      roughness: 0.92, metalness: 0, specularIntensity: 0.22,
      sheen: 1, sheenRoughness: 0.55, ...extra,
    })
    const materials = {
      body: cloth({ map: bodyMap, bumpMap: bodyBump, bumpScale: 0.9 }),
      fabric: cloth({ bumpMap: knit, bumpScale: 0.9 }),
      rib: cloth({ bumpMap: rib, bumpScale: 1.6 }),
      collar: cloth({ bumpMap: collarRib, bumpScale: 1.6 }),
      inner: new THREE.MeshStandardMaterial({ side: THREE.BackSide, roughness: 1 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x9a9a9e, metalness: 0.7, roughness: 0.35 }),
    }

    const pivot = new THREE.Group()
    scene.add(pivot)

    // contact shadow under the hem (showcase only)
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 256
    const sctx = shadowCanvas.getContext('2d')
    const grad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(0,0,0,0.7)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.3)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 256, 256)
    const shadowTex = new THREE.CanvasTexture(shadowCanvas)
    const floorShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.4),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    )
    floorShadow.rotation.x = -Math.PI / 2
    floorShadow.visible = live.current.showcase
    pivot.add(floorShadow)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      st.dirty = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const st = {
      renderer, scene, camera, pivot, materials, bodyMap, bodyBump, collarRib, floorShadow,
      garment: null, dirty: true, current: live.current.angle, spin: 0, sway: 0, settled: true,
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
      st.sway += dt
      const swayAmount = show && !imm ? Math.sin(st.sway * 0.8) * 4 : 0
      const moving = Math.abs(target - st.current) > 0.05
      if (st.garment && (moving || auto || show || st.dirty)) {
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
      ;[bodyMap, bodyBump, knit, rib, collarRib, shadowTex, envMap].forEach((t) => t.dispose())
      Object.values(materials).forEach((mat) => mat.dispose())
      floorShadow.geometry.dispose()
      floorShadow.material.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      three.current = null
    }
  }, [])

  // (re)build the garment meshes when the product changes
  useEffect(() => {
    const st = three.current
    if (!st) return
    const parts = getModel(modelKey)
    const { m } = parts
    const { materials: mat, pivot, camera } = st
    if (st.garment) pivot.remove(st.garment)
    const g = new THREE.Group()
    const add = (geo, material, opts = {}) => {
      const mesh = new THREE.Mesh(geo, material)
      mesh.castShadow = opts.cast !== false
      mesh.receiveShadow = true
      if (opts.mirror) mesh.scale.x = -1
      g.add(mesh)
    }
    add(parts.body.geo, mat.body)
    add(parts.body.geo, mat.inner, { cast: false })
    for (const mirror of [false, true]) {
      add(parts.sleeve.geo, mat.fabric, { mirror })
      add(parts.sleeve.geo, mat.inner, { mirror, cast: false })
      if (parts.sleeve.cap) add(parts.sleeve.cap, mat.fabric, { mirror })
      add(parts.sleeveHem, parts.sleeve.cuff ? mat.rib : mat.fabric, { mirror })
      if (parts.sleeve.cuff) add(parts.sleeve.cuff.geo, mat.rib, { mirror })
    }
    add(parts.hem, mat.fabric)
    if (parts.collar) add(parts.collar, mat.collar)
    if (parts.hood) {
      add(parts.hood.geo, mat.fabric)
      add(parts.hood.geo, mat.inner, { cast: false })
      add(parts.hood.rimGeo, mat.fabric)
      parts.strings.forEach((geo, i) => add(geo, i % 2 ? mat.metal : mat.fabric))
    }
    pivot.add(g)
    st.garment = g

    st.bodyBump.image = parts.bump
    st.bodyBump.needsUpdate = true
    // about one rib every 4 mm
    mat.rib.bumpMap.repeat.set((Math.PI * (m.sleeve.ra[1] + m.sleeve.rb[1])) / (8 * 0.004), 1)
    st.collarRib.repeat.set((Math.PI * (m.neck.w + m.neck.d)) / (8 * 0.004), 1)

    // frame the garment for the 410:480 stage
    const box = new THREE.Box3().setFromObject(g)
    const size = box.getSize(new THREE.Vector3())
    const cy = (box.min.y + box.max.y) / 2
    const tan = Math.tan(rad(FOV / 2))
    const dist = Math.max(size.y / 2 / tan, size.x / 2 / (tan * STAGE_ASPECT)) * 1.1 + size.z / 2
    if (live.current.showcase) {
      camera.position.set(0, cy + dist * 0.12, dist * 1.04)
      camera.lookAt(0, cy - 0.015, 0)
    } else {
      camera.position.set(0, cy, dist)
      camera.lookAt(0, cy, 0)
    }
    camera.updateMatrixWorld()
    st.floorShadow.position.y = box.min.y + 0.002

    // where the print area lands on screen when facing front, for the HTML editing overlay
    if (onPrintRect) {
      const p = m.print
      const z = table(m.depthFront, ((p.y0 + p.y1) / 2 - m.hem) / (m.shoulder - m.hem)) + 0.004
      const a = new THREE.Vector3(p.x0, p.y1, z).project(camera)
      const b = new THREE.Vector3(p.x1, p.y0, z).project(camera)
      const pct = (v) => `${(v * 100).toFixed(2)}%`
      onPrintRect({ left: pct((a.x + 1) / 2), top: pct((1 - a.y) / 2), width: pct((b.x - a.x) / 2), height: pct((a.y - b.y) / 2) })
    }
    st.dirty = true
  }, [modelKey])

  // colour + printed design
  useEffect(() => {
    const st = three.current
    if (!st) return
    const { m } = getModel(modelKey)
    const fabric = fabricColor(color)
    const sheen = fabric.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.3)
    for (const k of ['body', 'fabric', 'rib', 'collar']) st.materials[k].sheenColor.copy(sheen)
    st.materials.fabric.color.copy(fabric)
    st.materials.rib.color.copy(fabric).multiplyScalar(0.92)
    st.materials.collar.color.copy(fabric).multiplyScalar(0.92)
    st.materials.inner.color.copy(fabric).multiplyScalar(0.22)
    composeBody(st.bodyMap.image, m, fabric, layers, () => setAssetTick((t) => t + 1))
    st.bodyMap.needsUpdate = true
    st.dirty = true
  }, [modelKey, color, layers, assetTick])

  // static snapshots for the view thumbnails and order previews
  useEffect(() => {
    const st = three.current
    if (!st || !onThumbs || !thumbAngles) return
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
  }, [modelKey, color, layers, assetTick, thumbAngles?.join()])

  return <div ref={hostRef} className="g3d" />
}
