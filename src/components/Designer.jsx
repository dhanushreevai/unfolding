import { useEffect, useState } from 'react'
import Review from './Review.jsx'
import { Details, Payment, emptyCustomer } from './Checkout.jsx'
import Confirmation from './Confirmation.jsx'
import { PRODUCTS } from './garment.js'
import ShadowMount from '../studio/ShadowMount.jsx'
import Editor from '../studio/Editor.jsx'
import { blankDesign, colourOf, orderLayers } from '../studio/bridge.js'
import { renderView } from '../studio/raster.js'
import { loadDesign as loadSavedDesign, recordOrder, saveDesign, useAuth } from '../auth.jsx'

const storeKey = (product) => `up-design-${product}`
const TIP = { text: 'Drag sideways to turn the garment · drop an image anywhere', k: 0 }

// the design is kept in the browser per garment, so a refresh doesn't lose it
function loadDesign(product) {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey(product)))
    if (saved?.product === product && saved.layers?.front && saved.layers?.back) return saved
  } catch { /* nothing saved, or storage unavailable */ }
  return blankDesign(product)
}

export default function Designer({ product, onAddToBag, onOrderPlaced, step, setStep }) {
  const p = PRODUCTS[product]
  const [design, setDesign] = useState(() => loadDesign(product))
  const [size, setSize] = useState('L')
  const [message, setMessage] = useState(TIP)
  // checkout
  const [previews, setPreviews] = useState([])
  const [customer, setCustomer] = useState(emptyCustomer)
  const [delivery, setDelivery] = useState('standard')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [placed, setPlaced] = useState(null)
  // account: the saved copy this design belongs to (if any)
  const { user, enabled: accounts } = useAuth()
  const [savedId, setSavedId] = useState(() => sessionStorage.getItem(`up-saved-${product}`))
  const [saveLabel, setSaveLabel] = useState(null)
  useEffect(() => {
    if (savedId) sessionStorage.setItem(`up-saved-${product}`, savedId)
    else sessionStorage.removeItem(`up-saved-${product}`)
  }, [savedId, product])

  // arriving from the ChatGPT designer (…/?gpt=CODE#design-tshirt): put that artwork on the garment
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('gpt')
    if (!code) return
    // tidy the address bar so a refresh doesn't add it again
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    ;(async () => {
      try {
        const res = await fetch(`/api/gpt-design?code=${encodeURIComponent(code)}`)
        if (!res.ok) throw new Error()
        const blob = await res.blob()
        const src = await new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result)
          r.onerror = reject
          r.readAsDataURL(blob)
        })
        const layer = { id: `gpt${Date.now()}`, kind: 'image', src, x: 50, y: 45, scale: 90, rotate: 0 }
        setDesign((d) => ({ ...d, layers: { ...d.layers, front: [...d.layers.front, layer] } }))
        setStep(1)
        setMessage((m) => ({ text: 'Your ChatGPT design is on the front. Drag it, pull a corner to resize.', k: m.k + 1 }))
      } catch {
        setMessage((m) => ({ text: "That ChatGPT design couldn't be loaded. Ask the GPT to send it again.", k: m.k + 1 }))
      }
    })()
  }, [])

  // opening a design from "My designs"
  useEffect(() => {
    const openRequested = async () => {
      const id = sessionStorage.getItem('up-open-design')
      if (!id || !user) return
      sessionStorage.removeItem('up-open-design')
      try {
        const row = await loadSavedDesign(id)
        if (row.product !== product) return
        setDesign(row.design)
        setSavedId(row.id)
        setStep(1)
        setMessage((m) => ({ text: 'Your saved design is open', k: m.k + 1 }))
      } catch { /* deleted or not yours: keep the current design */ }
    }
    openRequested()
    window.addEventListener('up-open-design', openRequested)
    return () => window.removeEventListener('up-open-design', openRequested)
  }, [product, user])

  // each garment page has its own design
  useEffect(() => { setDesign(loadDesign(product)) }, [product])

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(storeKey(design.product), JSON.stringify(design)) } catch { /* storage full */ }
    }, 300)
    return () => clearTimeout(t)
  }, [design])

  const say = (text) => setMessage((m) => ({ text, k: m.k + 1 }))
  const color = colourOf(design)
  const layers = orderLayers(design)
  const showcase = { design, thumbUrls: previews, onThumbs: setPreviews }
  const startOver = () => { setDesign(blankDesign(product)); setSavedId(null); setPlaced(null); setStep(1) }

  const save = async () => {
    if (!user) { window.dispatchEvent(new Event('up-sign-in')); say('Sign in to save your designs'); return }
    setSaveLabel('Saving…')
    try {
      const preview = await renderView(design, 'front', 160)
      const id = await saveDesign({ id: savedId, product, design, preview })
      setSavedId(id)
      setSaveLabel('Saved ✓')
      say('Saved to your account')
    } catch (e) {
      setSaveLabel(null)
      say(`Could not save: ${e.message}`)
      return
    }
    setTimeout(() => setSaveLabel(null), 1800)
  }

  if (step === 2) {
    return (
      <Review productKey={product} product={p} design={design} color={color} size={size} layers={layers}
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
        onPlaced={(saved) => {
          setPlaced(saved); onOrderPlaced(); setStep(5)
          // signed in: add it to the customer's order history (the order itself is already saved)
          if (user) recordOrder({ id: saved.id, product, colour: color.name, size, total: saved.totals.total }).catch(() => {})
        }} />
    )
  }

  if (step === 5 && placed) {
    return (
      <Confirmation placed={placed} customer={customer} showcase={{ design }} onDesignAnother={startOver} />
    )
  }

  // step 1: the design studio (its own look, kept separate from the rest of the site)
  if (design.product !== product) return null
  return (
    <ShadowMount className="studio-host">
      <div className="studio-screen">
        <Editor design={design} setDesign={setDesign} size={size} setSize={setSize}
          onMessage={say} message={message} onContinue={() => setStep(2)}
          onSave={accounts ? save : undefined} saveLabel={saveLabel} />
      </div>
    </ShadowMount>
  )
}
