export * from '../catalog.js'

export const VIEWS = [
  { id: 'front', label: 'Front', angle: 0 },
  { id: 'back', label: 'Back', angle: 180 },
  // the side photos are true profile shots
  { id: 'left', label: 'Left', angle: -90 },
  { id: 'right', label: 'Right', angle: 90 },
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
