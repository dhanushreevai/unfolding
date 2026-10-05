import { useEffect, useRef, useState } from 'react'

const PRODUCTS = {
  tshirt: {
    name: 'T-Shirt', img: '/tshirt.jpg', price: 29,
    print: { left: '30%', top: '23%', width: '40%', height: '40%' },
    colors: [
      { name: 'White', swatch: '#f2f2f2', tint: '#ffffff' },
      { name: 'Black', swatch: '#0d0d0d', tint: '#262626' },
      { name: 'Grey', swatch: '#b5b5b5', tint: '#b0b0b0' },
      { name: 'Charcoal', swatch: '#3a3f47', tint: '#474c55' },
      { name: 'Sand', swatch: '#d8cfc2', tint: '#ddd2c2' },
    ],
  },
  hoodie: {
    name: 'Hoodie', img: '/hoodie.jpg', price: 49,
    print: { left: '32%', top: '27%', width: '36%', height: '27%' },
    colors: [
      { name: 'Black', swatch: '#0d0d0d', tint: '#ffffff', bright: 1 },
      { name: 'Charcoal', swatch: '#3a3f47', tint: '#c9d0da', bright: 2.2 },
      { name: 'Grey', swatch: '#8d8d8d', tint: '#ffffff', bright: 3.6 },
      { name: 'Navy', swatch: '#1f2a44', tint: '#6f86c4', bright: 3 },
      { name: 'Sand', swatch: '#d8cfc2', tint: '#e8d9c0', bright: 4 },
    ],
  },
}

const SIZES = ['S', 'M', 'L', 'XL', 'XXL']
const BACK_PRINT_PRICE = 5

const VIEWS = [
  { id: 'front', label: 'Front', angle: 0 },
  { id: 'back', label: 'Back', angle: 180 },
  { id: 'left', label: 'Left', angle: -55 },
  { id: 'right', label: 'Right', angle: 55 },
]

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

const nearestEquivalent = (target, current) => target + 360 * Math.round((current - target) / 360)
const viewFromAngle = (angle) => {
  const n = ((angle % 360) + 360) % 360
  let best = VIEWS[0], bestDist = Infinity
  for (const v of VIEWS) {
    const a = (v.angle + 360) % 360
    const d = Math.min(Math.abs(n - a), 360 - Math.abs(n - a))
    if (d < bestDist) { best = v; bestDist = d }
  }
  return best
}
const sideOf = (viewId) => (viewId === 'back' ? 'back' : 'front')
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

function Face({ side, product, color, layers, interactive, activeSide, selectedId, onSelect, onMove }) {
  const p = PRODUCTS[product]
  const sideLayers = layers.filter((l) => l.side === side)
  const areaRef = useRef(null)
  const showArea = interactive && side === activeSide

  const startDrag = (e, layer) => {
    if (!interactive) return
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
    <div className={`face ${side}`}>
      <div className="garment">
        <img src={p.img} alt={`${color.name} ${p.name}`} draggable="false"
          style={{ filter: color.bright ? `brightness(${color.bright})` : undefined }} />
        <div className="tint" style={{ background: color.tint }} />
      </div>
      <div ref={areaRef} className={`print-area${showArea ? ' active' : ''}`} style={p.print}>
        {showArea && <><i className="h tl" /><i className="h tr" /><i className="h bl" /><i className="h br" /></>}
        {showArea && sideLayers.length === 0 && <span className="placeholder">Your<br />design<br />here</span>}
        {sideLayers.map((l) => (
          <Layer key={l.id} layer={l} selected={interactive && l.id === selectedId}
            onPointerDown={(e) => startDrag(e, l)} />
        ))}
      </div>
    </div>
  )
}

function Garment({ angle, animate = true, ...props }) {
  return (
    <div className="spin" style={{ transform: `rotateY(${angle}deg)`, transition: animate ? undefined : 'none' }}>
      <Face side="front" {...props} />
      <Face side="back" {...props} />
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
            onClick={() => onAdd({ type: 'clip', d: c.d, color: active })}>
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

export default function Designer({ product, onChangeProduct, onAddToBag, step, setStep }) {
  const p = PRODUCTS[product]
  const [colorIdx, setColorIdx] = useState(0)
  const [size, setSize] = useState('L')
  const [tab, setTab] = useState('design')
  const [layers, setLayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [angle, setAngle] = useState(0)
  const [dragging, setDragging] = useState(false)

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
  const onStageDown = (e) => {
    setSelectedId(null)
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
      setAngle((a) => nearestEquivalent(viewFromAngle(a).angle, a))
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const hasBack = layers.some((l) => l.side === 'back')
  const total = p.price + (hasBack ? BACK_PRINT_PRICE : 0)
  const garmentProps = { product, color, layers }

  if (step === 2) {
    return (
      <div className="review">
        <div className="review-previews">
          {['front', 'back'].map((s) => (
            <figure key={s}>
              <div className="stage mini-stage"><Garment angle={s === 'back' ? 180 : 0} {...garmentProps} /></div>
              <figcaption>{s}</figcaption>
            </figure>
          ))}
        </div>
        <aside className="panel summary">
          <h2>Your {p.name}</h2>
          <dl>
            <dt>Colour</dt><dd>{color.name}</dd>
            <dt>Size</dt><dd>{size}</dd>
            <dt>Front print</dt><dd>{layers.filter((l) => l.side === 'front').length || 'None'}</dd>
            <dt>Back print</dt><dd>{hasBack ? `+$${BACK_PRINT_PRICE}` : 'None'}</dd>
            <dt className="total">Total</dt><dd className="total">${total}</dd>
          </dl>
          <button className="pill light big" onClick={() => { onAddToBag(); setStep(3) }}>
            Add to Bag <span>→</span>
          </button>
          <button className="pill ghost" onClick={() => setStep(1)}>← Back to design</button>
        </aside>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div className="done">
        <div className="done-check">✓</div>
        <h2>Added to your bag</h2>
        <p>Your {color.name.toLowerCase()} {p.name.toLowerCase()} (size {size}) is ready for checkout.</p>
        <div className="done-actions">
          <button className="pill ghost" onClick={() => { setLayers([]); setStep(1) }}>Design another</button>
          <a className="pill light" href="#">Continue shopping</a>
        </div>
      </div>
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
        <div className="stage" onPointerDown={onStageDown}>
          <Garment angle={angle} animate={!dragging} {...garmentProps} interactive activeSide={activeSide}
            selectedId={selectedId} onSelect={setSelectedId} onMove={updateLayer} />
        </div>
        <div className="drag-hint">Drag to rotate</div>
        <div className="thumbs">
          <button className="arrow" aria-label="Previous view" onClick={() => stepView(-1)}>‹</button>
          {VIEWS.map((v) => (
            <button key={v.id} className={`thumb${v.id === view.id ? ' on' : ''}`} onClick={() => goToView(v)} aria-label={v.label}>
              <div className="stage mini-stage"><Garment angle={v.angle} {...garmentProps} /></div>
            </button>
          ))}
          <button className="arrow" aria-label="Next view" onClick={() => stepView(1)}>›</button>
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
