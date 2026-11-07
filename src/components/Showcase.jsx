import { useEffect, useRef, useState } from 'react'
import ShadowMount from '../studio/ShadowMount.jsx'
import FoldSwap from '../studio/FoldSwap.jsx'
import Stage from '../studio/Stage.jsx'
import { VIEWS as TURN_ORDER, VIEW_LABEL } from '../studio/garments.js'
import { renderView } from '../studio/raster.js'
import { VIEWS } from './garment.js'

const AUTOPLAY_MS = 4500

function ViewThumbs({ thumbs, view, onPick, className }) {
  return (
    <div className={className}>
      {VIEWS.map((v, i) => (
        <button key={v.id} className={`view-card${v.id === view ? ' on' : ''}`} onClick={() => onPick(v.id)}>
          {thumbs[i] ? <img src={thumbs[i]} alt="" draggable="false" /> : <span className="thumb-ph" />}
          <span>{v.label}</span>
        </button>
      ))}
    </div>
  )
}

// The studio garment, read-only, turning between sides with the studio's turn transition.
function StudioView({ design, view, dir }) {
  const state = { product: design.product, view, color: design.color, layers: design.layers[view] || [] }
  return (
    <FoldSwap
      k={`${design.product}|${view}|${design.color}`}
      mode="turn"
      dir={dir}
      state={state}
      still={(s) => <Stage product={s.product} view={s.view} color={s.color} layers={s.layers} lite />}
      live={<Stage product={state.product} view={view} color={state.color} layers={state.layers} />}
    />
  )
}

/**
 * The garment shown on review / checkout / confirmation: the same real-photo garment as the
 * design studio. thumbs: 'side' (column on the left), 'below', or 'none'.
 * thumbUrls/onThumbs: pictures of each view, lifted to the parent for order cards and previews.
 */
export default function Showcase({
  design, thumbs = 'side', top = null, arrows = true, dashes = false, thumbUrls = [], onThumbs,
}) {
  const [view, setView] = useState('front')
  const [dir, setDir] = useState(1)
  const lastTouch = useRef(Date.now())

  const go = (v, d) => {
    if (v === view) return
    lastTouch.current = Date.now()
    const step = (TURN_ORDER.indexOf(v) - TURN_ORDER.indexOf(view) + 4) % 4
    setDir(d ?? (step === 3 ? -1 : 1))
    setView(v)
  }
  const stepView = (d) => go(TURN_ORDER[(TURN_ORDER.indexOf(view) + d + 4) % 4], d)

  // turn round the garment on its own when left alone, like a display stand
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastTouch.current < AUTOPLAY_MS) return
      lastTouch.current = Date.now()
      setDir(1)
      setView((v) => TURN_ORDER[(TURN_ORDER.indexOf(v) + 1) % 4])
    }, 500)
    return () => clearInterval(id)
  }, [])

  // pictures of every view, for the thumbnails and the order previews
  useEffect(() => {
    if (!onThumbs) return
    let on = true
    Promise.all(VIEWS.map((v) => renderView(design, v.id, 300))).then((urls) => on && onThumbs(urls))
    return () => { on = false }
  }, [design])

  // swipe sideways to turn (vertical swipes still scroll the page)
  const onPointerDown = (e) => {
    const sx = e.clientX, sy = e.clientY
    let done = false
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      if (!done && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        done = true
        stepView(dx < 0 ? 1 : -1)
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className={`showcase-wrap thumbs-${thumbs}`}>
      {thumbs === 'side' && (
        <aside className="review-views">
          {top}
          <ViewThumbs className="view-list" thumbs={thumbUrls} view={view} onPick={(v) => go(v)} />
        </aside>
      )}
      <section className="review-stage">
        {thumbs !== 'side' && top}
        <div className="showcase">
          {arrows && (
            <button className="round-arrow prev" aria-label="Previous view" onClick={() => stepView(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
          )}
          <div className="stage studio-stage" onPointerDown={onPointerDown}>
            <div className="floor spot" />
            <ShadowMount className="studio-host-view">
              <StudioView design={design} view={view} dir={dir} />
            </ShadowMount>
          </div>
          {arrows && (
            <button className="round-arrow next" aria-label="Next view" onClick={() => stepView(1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
        {thumbs !== 'below' && (
          <div className="drag-hint with-icon">
            <svg width="14" height="20" viewBox="0 0 14 20" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1" y="1" width="12" height="18" rx="6" /><path d="M7 5v3" />
            </svg>
            Swipe to turn · {VIEW_LABEL[view]}
          </div>
        )}
        {dashes && (
          <div className="dashes">
            {VIEWS.map((v) => (
              <button key={v.id} className={v.id === view ? 'on' : ''} aria-label={v.label} onClick={() => go(v.id)} />
            ))}
          </div>
        )}
        {thumbs === 'below' && <ViewThumbs className="view-row" thumbs={thumbUrls} view={view} onPick={(v) => go(v)} />}
      </section>
    </div>
  )
}
