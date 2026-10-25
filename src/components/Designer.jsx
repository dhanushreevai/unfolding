import { useEffect, useRef, useState } from 'react'
import Garment3D from './PhotoViewer.jsx'
import Review from './Review.jsx'
import { Details, Payment, emptyCustomer } from './Checkout.jsx'
import Confirmation from './Confirmation.jsx'
import { PRODUCTS, SIZES, VIEWS, isSquare, nearestEquivalent, viewFromAngle, useSpin } from './garment.js'

const FONTS = [
  { label: 'Bold', family: "'Montserrat', sans-serif", weight: 900 },
  { label: 'Clean', family: "'Poppins', sans-serif", weight: 600 },
  { label: 'Serif', family: 'Georgia, serif', weight: 700 },
  { label: 'Mono', family: "'Courier New', monospace", weight: 700 },
]

const INK = ['#111111', '#ffffff', '#d72638', '#f5b700', '#1b998b', '#3a86ff']

const CLIPART = [
  { name: 'Star', d: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z' },
  { name: 'Heart', d: 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.7 1.1 5.4 3 1.7-1.9 3.3-3 5.4-3 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z' },
  { name: 'Bolt', d: 'M13 2L4 14h6l-1 8 9-12h-6z' },
  { name: 'Crown', d: 'M3 18h18l1-11-5.5 4L12 4l-4.5 7L2 7zM3 20h18v2H3z' },
  { name: 'Flame', d: 'M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 1-6.5 1-8.5zM12 22a7 7 0 0 1-7-7c0-1 .2-2 .6-2.9C6.4 15 8.5 17 12 17s5.6-2 6.4-4.9c.4.9.6 1.9.6 2.9a7 7 0 0 1-7 7z' },
  { name: 'Smile', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 18c-2.8 0-5-1.8-5.6-4h11.2c-.6 2.2-2.8 4-5.6 4z' },
  { name: 'Peace', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 2.1v6.5L5.9 15.7A8 8 0 0 1 11 4.1zm2 0a8 8 0 0 1 5.1 11.6L13 10.6zM11 13.4v6.5a8 8 0 0 1-3.7-1.8zm2 0l3.7 4.7a8 8 0 0 1-3.7 1.8z' },
  { name: 'Arrow', d: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z' },
]

const sideOf = (viewId) => (viewId === 'back' ? 'back' : 'front')
const THUMB_ANGLES = VIEWS.map((v) => v.angle)
let nextId = 1

/* ---------- garment stage ---------- */

function Layer({ layer, selected, onPointerDown }) {
  const style = {
    left: `${layer.x}%`, top: `${layer.y}%`,
    transform: `translate(-50%, -50%) rotate(${layer.rotate}deg)`,
  }
  let content
  if (layer.type === 'text') {
    content = (
      <span className="layer-text" style={{
        fontFamily: layer.font.family, fontWeight: layer.font.weight, color: layer.color,
        fontSize: `${16 * layer.scale}cqw`,
      }}>{layer.text}</span>
    )
  } else if (layer.type === 'clip') {
    content = (
      <svg viewBox="0 0 24 24" style={{ width: `${45 * layer.scale}cqw` }} fill={layer.color}><path d={layer.d} /></svg>
    )
  } else {
    content = <img src={layer.src} alt="" draggable="false" style={{ width: `${70 * layer.scale}cqw` }} />
  }
  return (
    <div className={`layer${selected ? ' selected' : ''}`} style={style} onPointerDown={onPointerDown}>
      {content}
    </div>
  )
}

// Invisible, draggable stand-ins for the layers printed on the 3D garment,
// lined up with the print area while the garment faces the camera.
function PrintOverlay({ print, side, layers, selectedId, onSelect, onMove }) {
  const sideLayers = layers.filter((l) => l.side === side)
  const areaRef = useRef(null)

  const startDrag = (e, layer) => {
    e.stopPropagation()
    onSelect(layer.id)
    const rect = areaRef.current.getBoundingClientRect()
    const start = { px: e.clientX, py: e.clientY, x: layer.x, y: layer.y }
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev) => {
      const x = start.x + ((ev.clientX - start.px) / rect.width) * 100
      const y = start.y + ((ev.clientY - start.py) / rect.height) * 100
      onMove(layer.id, { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  return (
    <div className="print-overlay">
      <div ref={areaRef} className="print-area active" style={print}>
        <i className="h tl" /><i className="h tr" /><i className="h bl" /><i className="h br" />
        {sideLayers.length === 0 && <span className="placeholder">Your<br />design<br />here</span>}
        {sideLayers.map((l) => (
          <Layer key={l.id} layer={l} selected={l.id === selectedId} onPointerDown={(e) => startDrag(e, l)} />
        ))}
      </div>
    </div>
  )
}

/* ---------- side panel tabs ---------- */

function UploadTab({ onAdd }) {
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)

  const handle = (file) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|svg\+xml)$/.test(file.type)) return setError('Please choose a PNG, JPG or SVG file.')
    if (file.size > 10 * 1024 * 1024) return setError('That file is over 10MB.')
    setError('')
    const reader = new FileReader()
    reader.onload = () => onAdd({ type: 'image', src: reader.result, name: file.name })
    reader.readAsDataURL(file)
  }

  return (
    <div className={`dropzone${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]) }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 14v6h16v-6M12 4v11M7.5 8.5 12 4l4.5 4.5" />
      </svg>
      <strong>Upload your design</strong>
      <small>PNG, JPG, SVG (Max 10MB)</small>
      <button className="pill light" onClick={() => inputRef.current.click()}>Choose File</button>
      <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" hidden
        onChange={(e) => { handle(e.target.files[0]); e.target.value = '' }} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

function TextTab({ selected, onAdd, onChange }) {
  const editing = selected?.type === 'text'
  const [draft, setDraft] = useState({ text: '', font: FONTS[0], color: INK[0] })
  const value = editing ? selected : draft
  const set = (patch) => (editing ? onChange(selected.id, patch) : setDraft({ ...draft, ...patch }))

  return (
    <div className="text-tab">
      <input className="field" placeholder="Type your text" value={value.text} maxLength={40}
        onChange={(e) => set({ text: e.target.value })} />
      <div className="label-sm">Font</div>
      <div className="chips">
        {FONTS.map((f) => (
          <button key={f.label} className={`chip${value.font.label === f.label ? ' on' : ''}`}
            style={{ fontFamily: f.family, fontWeight: f.weight }} onClick={() => set({ font: f })}>{f.label}</button>
        ))}
      </div>
      <div className="label-sm">Colour</div>
      <div className="swatches small">
        {INK.map((c) => (
          <button key={c} className={`swatch${value.color === c ? ' on' : ''}`} style={{ background: c }}
            aria-label={c} onClick={() => set({ color: c })} />
        ))}
      </div>
      {!editing && (
        <button className="pill light" disabled={!draft.text.trim()}
          onClick={() => { onAdd({ type: 'text', ...draft, text: draft.text.trim() }); setDraft({ ...draft, text: '' }) }}>
          Add Text
        </button>
      )}
      {editing && <p className="hint">Editing selected text. Click the garment background to deselect.</p>}
    </div>
  )
}

function ClipartTab({ selected, onAdd, onChange }) {
  const [color, setColor] = useState(INK[0])
  const editing = selected?.type === 'clip'
  const active = editing ? selected.color : color
  return (
    <div className="clip-tab">
      <div className="clip-grid">
        {CLIPART.map((c) => (
          <button key={c.name} className="clip" aria-label={c.name} title={c.name}
            onClick={() => onAdd({ type: 'clip', d: c.d, name: c.name, color: active })}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d={c.d} /></svg>
          </button>
        ))}
      </div>
      <div className="label-sm">Colour</div>
      <div className="swatches small">
        {INK.map((c) => (
          <button key={c} className={`swatch${active === c ? ' on' : ''}`} style={{ background: c }} aria-label={c}
            onClick={() => (editing ? onChange(selected.id, { color: c }) : setColor(c))} />
        ))}
      </div>
    </div>
  )
}

/* ---------- page ---------- */

const ICONS = {
  center: <path d="M12 3v18M6 8h12v8H6z" />,
  top: <path d="M5 4h14M12 20V8M8 12l4-4 4 4" />,
  middle: <path d="M5 12h14M12 3v5M9 6l3 3 3-3M12 21v-5M9 18l3-3 3 3" />,
  bottom: <path d="M5 20h14M12 4v12M8 12l4 4 4-4" />,
}
const ALIGN = { center: { x: 50 }, top: { y: 18 }, middle: { y: 50 }, bottom: { y: 82 } }

export default function Designer({ product, onChangeProduct, onAddToBag, onOrderPlaced, step, setStep }) {
  const p = PRODUCTS[product]
  const [colorIdx, setColorIdx] = useState(0)
  const [size, setSize] = useState('L')
  const [tab, setTab] = useState('design')
  const [layers, setLayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const { angle, setAngle, dragging, onPointerDown: spinDown } = useSpin()
  const [settled, setSettled] = useState(true)
  const [thumbs, setThumbs] = useState([])
  const [printRect, setPrintRect] = useState(null)
  const [zoomed, setZoomed] = useState(false)
  // checkout
  const [previews, setPreviews] = useState([])
  const [customer, setCustomer] = useState(emptyCustomer)
  const [delivery, setDelivery] = useState('standard')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [placed, setPlaced] = useState(null)

  const color = p.colors[Math.min(colorIdx, p.colors.length - 1)]
  const view = viewFromAngle(angle)
  const activeSide = sideOf(view.id)
  const selected = layers.find((l) => l.id === selectedId)

  useEffect(() => { setColorIdx(0) }, [product])

  const addLayer = (data) => {
    const layer = { id: nextId++, side: activeSide, x: 50, y: 50, scale: 1, rotate: 0, ...data }
    setLayers((ls) => [...ls, layer])
    setSelectedId(layer.id)
  }
  const updateLayer = (id, patch) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const removeLayer = (id) => { setLayers((ls) => ls.filter((l) => l.id !== id)); setSelectedId(null) }

  useEffect(() => {
    const onKey = (e) => {
      if (!selectedId || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') removeLayer(selectedId)
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const goToView = (v) => { setAngle((a) => nearestEquivalent(v.angle, a)); setSelectedId(null) }
  const stepView = (dir) => goToView(VIEWS[(VIEWS.indexOf(view) + dir + VIEWS.length) % VIEWS.length])

  // drag on empty stage space to spin the garment
  const onStageDown = (e) => { setSelectedId(null); spinDown(e) }

  const garmentProps = { product: p, color, layers }

  const showcase = { product: p, color, layers, thumbUrls: previews, onThumbs: setPreviews }
  const startOver = () => { setLayers([]); setPlaced(null); setStep(1) }

  if (step === 2) {
    return (
      <Review productKey={product} product={p} color={color} size={size} layers={layers}
        previews={previews} onPreviews={setPreviews}
        onEdit={() => setStep(1)} onBuy={() => { onAddToBag(); setStep(3) }} />
    )
  }

  if (step === 3) {
    return (
      <Details showcase={showcase} customer={customer} setCustomer={setCustomer}
        delivery={delivery} setDelivery={setDelivery} onBack={() => setStep(2)} onNext={() => setStep(4)} />
    )
  }

  if (step === 4) {
    return (
      <Payment showcase={showcase} onBack={() => setStep(3)}
        order={{ productKey: product, product: p, color, size, layers, previews, customer, delivery, paymentMethod, setPaymentMethod }}
        onPlaced={(saved) => { setPlaced(saved); onOrderPlaced(); setStep(5) }} />
    )
  }

  if (step === 5 && placed) {
    return (
      <Confirmation placed={placed} customer={customer}
        showcase={{ product: p, color, layers }} onDesignAnother={startOver} />
    )
  }

  return (
    <div className="designer">
      {/* left: product, colour, size */}
      <aside className="options">
        <a className="back-link" href="#">← Change product</a>
        <div className="product-cards">
          {Object.entries(PRODUCTS).map(([key, prod]) => (
            <button key={key} className={`product-card${key === product ? ' on' : ''}`} onClick={() => onChangeProduct(key)}>
              <img src={prod.img} alt="" draggable="false" />
              <span>{prod.name}</span>
            </button>
          ))}
        </div>
        <hr />
        <div className="label">Colour <em>{color.name}</em></div>
        <div className="swatches">
          {p.colors.map((c, i) => (
            <button key={c.name} className={`swatch${i === colorIdx ? ' on' : ''}`} style={{ background: c.swatch }}
              aria-label={c.name} title={c.name} onClick={() => setColorIdx(i)} />
          ))}
        </div>
        <hr />
        <div className="label">Size</div>
        <div className="sizes">
          {SIZES.map((s) => (
            <button key={s} className={`size${s === size ? ' on' : ''}`} onClick={() => setSize(s)}>{s}</button>
          ))}
        </div>
      </aside>

      {/* centre: garment */}
      <section className="canvas">
        {/* same presentation as the review page: round arrows, spotlight, hover zoom */}
        <div className="showcase">
          <button className="round-arrow prev" aria-label="Previous view" onClick={() => stepView(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div className="stage" onPointerDown={onStageDown}>
            <div className="floor spot" />
            <Garment3D {...garmentProps} angle={angle} immediate={dragging} onSettle={setSettled} onPrintRect={setPrintRect}
              thumbAngles={THUMB_ANGLES} onThumbs={setThumbs} showcase onZoom={setZoomed} />
            {settled && !dragging && printRect && isSquare(angle) && (
              // the print box steps aside while the photo is zoomed, and returns when the pointer reaches it
              <div className={`print-overlay-wrap${zoomed ? ' hidden' : ''}`}>
                <PrintOverlay print={printRect} side={activeSide} layers={layers}
                  selectedId={selectedId} onSelect={setSelectedId} onMove={updateLayer} />
              </div>
            )}
          </div>
          <button className="round-arrow next" aria-label="Next view" onClick={() => stepView(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="drag-hint with-icon">
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="1" y="1" width="12" height="18" rx="6" /><path d="M7 5v3" />
          </svg>
          Swipe to browse · hover to zoom
        </div>
        <div className="thumbs">
          {VIEWS.map((v, i) => (
            <button key={v.id} className={`thumb${v.id === view.id ? ' on' : ''}`} onClick={() => goToView(v)} aria-label={v.label}>
              {thumbs[i] && <img src={thumbs[i]} alt="" draggable="false" />}
            </button>
          ))}
        </div>
      </section>

      {/* right: tools */}
      <aside className="tools">
        <div className="panel">
          <div className="tabs">
            {['design', 'text', 'clipart'].map((t) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div className="panel-body">
            {tab === 'design' && <UploadTab onAdd={addLayer} />}
            {tab === 'text' && <TextTab selected={selected} onAdd={addLayer} onChange={updateLayer} />}
            {tab === 'clipart' && <ClipartTab selected={selected} onAdd={addLayer} onChange={updateLayer} />}
          </div>

          <div className="panel-section">
            <div className="section-head">
              <span className="label-sm">Position &amp; Size</span>
              {selected && <button className="remove" onClick={() => removeLayer(selected.id)}>Remove</button>}
            </div>
            <div className="align">
              {Object.keys(ALIGN).map((k) => (
                <button key={k} title={`Align ${k}`} aria-label={`Align ${k}`} disabled={!selected}
                  onClick={() => updateLayer(selected.id, ALIGN[k])}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{ICONS[k]}</svg>
                </button>
              ))}
            </div>
            <label className="slider">
              <span>Size</span>
              <input type="range" min="20" max="200" disabled={!selected}
                value={selected ? Math.round(selected.scale * 100) : 100}
                onChange={(e) => updateLayer(selected.id, { scale: e.target.value / 100 })} />
              <output>{selected ? Math.round(selected.scale * 100) : 100}%</output>
            </label>
            <label className="slider">
              <span>Rotate</span>
              <input type="range" min="-180" max="180" disabled={!selected}
                value={selected ? selected.rotate : 0}
                onChange={(e) => updateLayer(selected.id, { rotate: +e.target.value })} />
              <output>{selected ? selected.rotate : 0}°</output>
            </label>
            {!selected && <p className="hint">Add or select a design element to adjust it.</p>}
          </div>

          <div className="panel-section">
            <span className="label-sm">View</span>
            <div className="views">
              {VIEWS.map((v) => (
                <button key={v.id} className={v.id === view.id ? 'on' : ''} onClick={() => goToView(v)}>{v.label}</button>
              ))}
            </div>
          </div>
        </div>
        <button className="pill light big" disabled={layers.length === 0} onClick={() => { setSelectedId(null); setStep(2) }}>
          Continue <span>→</span>
        </button>
      </aside>
    </div>
  )
}
