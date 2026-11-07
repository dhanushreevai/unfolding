import { useEffect, useState } from 'react'
import Review from './Review.jsx'
import { Details, Payment, emptyCustomer } from './Checkout.jsx'
import Confirmation from './Confirmation.jsx'
import { PRODUCTS } from './garment.js'
import ShadowMount from '../studio/ShadowMount.jsx'
import Editor from '../studio/Editor.jsx'
import { blankDesign, colourOf, orderLayers } from '../studio/bridge.js'

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
  const startOver = () => { setDesign(blankDesign(product)); setPlaced(null); setStep(1) }

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
        onPlaced={(saved) => { setPlaced(saved); onOrderPlaced(); setStep(5) }} />
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
          onMessage={say} message={message} onContinue={() => setStep(2)} />
      </div>
    </ShadowMount>
  )
}
