import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Product from './components/Product.jsx'
import Tshirt from './components/Tshirt.jsx'
import Hoodie from './components/Hoodie.jsx'
import Explore from './components/Explore.jsx'
// three.js lives in the designer, so only load it when a design page is opened
const Designer = lazy(() => import('./components/Designer.jsx'))

const ROUTES = { '#design-tshirt': 'tshirt', '#design-hoodie': 'hoodie' }

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => { setHash(window.location.hash); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  // the bag holds one garment at a time: which one ('tshirt' / 'hoodie'), or null
  const [bag, setBag] = useState(null)
  const cartCount = bag ? 1 : 0
  const [step, setStep] = useState(1)
  const product = ROUTES[hash]
  const resume = useRef(null) // a step to open when arriving on a garment page from the bag

  useEffect(() => { setStep(resume.current || 1); resume.current = null }, [product])

  // bag button: back to checkout (your details) for the garment in the bag
  const openBag = () => {
    if (!bag) return
    if (product === bag) { setStep(3); return }
    resume.current = 3
    window.location.hash = `#design-${bag}`
  }

  return (
    <>
    {product ? (
      <section className="design-page">
        <Header cartCount={cartCount} onBag={openBag} step={step <= 4 ? step : null} secure={step === 3 || step === 4} />
        <Suspense fallback={null}>
        <Designer
          product={product}
          onAddToBag={() => setBag(product)}
          onOrderPlaced={() => setBag(null)}
          step={step}
          setStep={setStep}
        />
        </Suspense>
      </section>
    ) : (
    <section className="hero">
      <Header cartCount={cartCount} onBag={openBag} />

      <Product label="Design T-Shirt" href="#design-tshirt">
        <Tshirt />
      </Product>

      <div className="center">
        <h1>Unfolding<br />People</h1>
        <p className="sub">Design your own clothing</p>
        <div className="dash" />
        <p className="tag">Your ideas.<br />Our quality.<br />No limits.</p>
      </div>

      <Product label="Design Hoodie" href="#design-hoodie">
        <Hoodie />
      </Product>

      <button className="scroll" onClick={() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })}>
        <div className="mouse" />
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff"><path d="M5 0v9M1.5 6L5 9.5 8.5 6" /></svg>
        <span>Scroll to explore</span>
      </button>
      <div className="corner l">Custom clothing<br />made by you</div>
      <div className="corner r">For a more<br />original tomorrow</div>
    </section>
    )}
    {!product && <Explore />}
    <footer className="footer">
      Powered by <a href="https://www.thezevenx.com/" target="_blank" rel="noopener noreferrer">ZEVENX</a>
    </footer>
    </>
  )
}
