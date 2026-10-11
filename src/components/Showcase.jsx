import Garment3D from './Garment3D.jsx'
import { VIEWS, nearestEquivalent, viewFromAngle, useSpin } from './garment.js'

const THUMB_ANGLES = VIEWS.map((v) => v.angle)

function ViewThumbs({ thumbs, view, onPick, className }) {
  return (
    <div className={className}>
      {VIEWS.map((v, i) => (
        <button key={v.id} className={`view-card${v.id === view.id ? ' on' : ''}`} onClick={() => onPick(v)}>
          {thumbs[i] ? <img src={thumbs[i]} alt="" draggable="false" /> : <span className="thumb-ph" />}
          <span>{v.label}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * The turntable garment used on review / checkout / confirmation.
 * thumbs: 'side' (column on the left), 'below', or 'none'.
 * thumbUrls/onThumbs: renders of each view, lifted to the parent for order cards and previews.
 */
export default function Showcase({
  product, color, layers, thumbs = 'side', top = null, arrows = true, dashes = false,
  thumbUrls = [], onThumbs,
}) {
  const { angle, setAngle, dragging, onPointerDown } = useSpin(true)
  const view = viewFromAngle(angle)
  const goToView = (v) => setAngle((a) => nearestEquivalent(v.angle, a))
  const stepView = (dir) => goToView(VIEWS[(VIEWS.indexOf(view) + dir + VIEWS.length) % VIEWS.length])

  return (
    <div className={`showcase-wrap thumbs-${thumbs}`}>
      {thumbs === 'side' && (
        <aside className="review-views">
          {top}
          <ViewThumbs className="view-list" thumbs={thumbUrls} view={view} onPick={goToView} />
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
          <div className="stage" onPointerDown={onPointerDown}>
            <div className="floor spot" />
            <Garment3D product={product} color={color} layers={layers} angle={angle} immediate={dragging}
              showcase thumbAngles={onThumbs ? THUMB_ANGLES : undefined} onThumbs={onThumbs} />
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
            Drag to rotate
          </div>
        )}
        {dashes && (
          <div className="dashes">
            {VIEWS.map((v) => (
              <button key={v.id} className={v.id === view.id ? 'on' : ''} aria-label={v.label} onClick={() => goToView(v)} />
            ))}
          </div>
        )}
        {thumbs === 'below' && <ViewThumbs className="view-row" thumbs={thumbUrls} view={view} onPick={goToView} />}
      </section>
    </div>
  )
}
