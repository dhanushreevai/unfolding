import { Suspense, lazy, useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import Product from './components/Product.jsx'
import Tshirt from './components/Tshirt.jsx'
import Hoodie from './components/Hoodie.jsx'
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
  const [cartCount, setCartCount] = useState(0)
  const [step, setStep] = useState(1)
  const product = ROUTES[hash]

  useEffect(() => { setStep(1) }, [product])

  return (
    <>
    {product ? (
      <section className="design-page">
        <Header cartCount={cartCount} step={step} />
        <Suspense fallback={null}>
        <Designer
          product={product}
          onChangeProduct={(p) => { window.location.hash = p === 'hoodie' ? 'design-hoodie' : 'design-tshirt' }}
          onAddToBag={() => setCartCount((c) => c + 1)}
          step={step}
          setStep={setStep}
        />
        </Suspense>
      </section>
    ) : (
    <section className="hero">
      <Header cartCount={cartCount} />

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

      <div className="scroll">
        <div className="mouse" />
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff"><path d="M5 0v9M1.5 6L5 9.5 8.5 6" /></svg>
        <span>Scroll to explore</span>
      </div>
      <div className="corner l">Custom clothing<br />made by you</div>
      <div className="corner r">For a more<br />original tomorrow</div>
    </section>
    )}
    <footer className="footer">
      Powered by <b>ZEVENX</b>
    </footer>
    </>
  )
}
