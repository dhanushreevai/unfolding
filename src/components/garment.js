import { useState } from 'react'

export * from '../catalog.js'

export const VIEWS = [
  { id: 'front', label: 'Front', angle: 0 },
  { id: 'back', label: 'Back', angle: 180 },
  { id: 'left', label: 'Left', angle: -50 },
  { id: 'right', label: 'Right', angle: 50 },
]

export const nearestEquivalent = (target, current) => target + 360 * Math.round((current - target) / 360)
export const viewFromAngle = (angle) => {
  const n = ((angle % 360) + 360) % 360
  let best = VIEWS[0], bestDist = Infinity
  for (const v of VIEWS) {
    const a = (v.angle + 360) % 360
    const d = Math.min(Math.abs(n - a), 360 - Math.abs(n - a))
    if (d < bestDist) { best = v; bestDist = d }
  }
  return best
}
// Drag horizontally to spin; optionally snap to the nearest view on release.
export function useSpin(snap) {
  const [angle, setAngle] = useState(0)
  const [dragging, setDragging] = useState(false)
  const onPointerDown = (e) => {
    const startX = e.clientX, startAngle = angle
    let moved = false
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev) => {
      const dx = ev.clientX - startX
      if (Math.abs(dx) > 3) { moved = true; setDragging(true) }
      if (moved) setAngle(startAngle + dx * 0.45)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      setDragging(false)
      if (snap) setAngle((a) => nearestEquivalent(viewFromAngle(a).angle, a))
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  return { angle, setAngle, dragging, onPointerDown }
}
