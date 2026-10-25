import { useEffect, useRef, useState } from 'react'

export * from '../catalog.js'

export const VIEWS = [
  { id: 'front', label: 'Front', angle: 0 },
  { id: 'back', label: 'Back', angle: 180 },
  { id: 'left', label: 'Left', angle: -40 },
  { id: 'right', label: 'Right', angle: 40 },
]

export const nearestEquivalent = (target, current) => target + 360 * Math.round((current - target) / 360)
const wrap = (a) => ((a % 360) + 360) % 360
const gap = (a, b) => Math.min(Math.abs(wrap(a) - wrap(b)), 360 - Math.abs(wrap(a) - wrap(b)))
export const viewFromAngle = (angle) => {
  let best = VIEWS[0], bestDist = Infinity
  for (const v of VIEWS) {
    const d = gap(angle, v.angle)
    if (d < bestDist) { best = v; bestDist = d }
  }
  return best
}
// true when the garment faces the camera squarely (front or back), so prints can be edited
export const isSquare = (angle) => gap(angle, 0) < 0.5 || gap(angle, 180) < 0.5

const AUTOPLAY_DELAY = 4000 // ms on one shot before the showcase moves to the next

/**
 * Drag horizontally to turn the shirt. Garment3D shows small turns as real tilt and plays a
 * flip transition when the angle crosses to the other side; on release it springs to a view.
 * - settleFaces: always settle squarely on the front or back (design page, for editing prints)
 * - autoplay: every few seconds untouched, turn over to show the other side (review pages)
 */
export function useSpin({ settleFaces = false, autoplay = false } = {}) {
  const [angle, setAngleState] = useState(0)
  const [dragging, setDragging] = useState(false)
  const lastTouch = useRef(performance.now())
  const touch = () => { lastTouch.current = performance.now() }
  const setAngle = (v) => { touch(); setAngleState(v) }

  useEffect(() => {
    if (!autoplay || dragging) return
    // review pages: every so often, turn round to show the back, then return to the front
    const id = setInterval(() => {
      if (performance.now() - lastTouch.current > AUTOPLAY_DELAY) {
        lastTouch.current = performance.now()
        // next shot round: front -> right -> back -> left -> front
        const order = [0, 40, 180, 320]
        setAngleState((a) => {
          const here = order.reduce((b, v) => (gap(a, v) < gap(a, b) ? v : b), 0)
          const next = order[(order.indexOf(here) + 1) % order.length]
          return a + (((next - here) % 360) + 360) % 360
        })
      }
    }, 250)
    return () => clearInterval(id)
  }, [autoplay, dragging])

  const onPointerDown = (e) => {
    touch()
    const startX = e.clientX, startY = e.clientY, startAngle = angle
    let moved = false
    let last = { x: e.clientX, t: performance.now() }, velocity = 0 // degrees per second
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev) => {
      touch()
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      if (!moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2) { moved = true; setDragging(true) }
      if (moved) setAngleState(startAngle + dx * 0.35)
      const now = performance.now(), dt = Math.max(1, now - last.t)
      velocity = velocity * 0.6 + (((ev.clientX - last.x) * 0.35) / dt) * 1000 * 0.4
      last = { x: ev.clientX, t: now }
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      touch()
      setDragging(false)
      // momentum: carry on in the direction of the flick (a held finger has no momentum)
      const held = performance.now() - last.t > 80
      // a flick carries on to the next shot; then it settles on the nearest shot
      const glide = moved && !held ? Math.max(-90, Math.min(90, velocity * 0.15)) : 0
      setAngleState((a) => {
        const end = a + glide
        if (settleFaces) return nearestEquivalent(gap(end, 0) <= gap(end, 180) ? 0 : 180, end)
        return nearestEquivalent(viewFromAngle(end).angle, end)
      })
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  return { angle, setAngle, dragging, onPointerDown }
}
