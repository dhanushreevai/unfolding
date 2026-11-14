import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AccountButton from './Account.jsx'
import { useAuth } from '../auth.jsx'
import { PRODUCTS, formatPrice } from '../catalog.js'

const STEPS = ['Design', 'Review', 'Details', 'Payment']

/* The menu: a panel that slides in from the right, above the page and the design studio. */
function Menu({ onClose, cartCount, onBag }) {
  const { user, enabled } = useAuth()
  useEffect(() => {
    const key = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const signIn = () => { onClose(); window.dispatchEvent(new Event('up-sign-in')) }
  return createPortal(
    <div className="menu-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <nav className="menu-panel" aria-label="Menu">
        <button className="menu-close" onClick={onClose} aria-label="Close menu">×</button>
        <a href="#" onClick={onClose}>Home</a>
        <a href="#design-tshirt" onClick={onClose}>Design a T-Shirt <small>{formatPrice(PRODUCTS.tshirt.price)}</small></a>
        <a href="#design-hoodie" onClick={onClose}>Design a Hoodie <small>{formatPrice(PRODUCTS.hoodie.price)}</small></a>
        {cartCount > 0
          ? <button onClick={() => { onClose(); onBag() }}>Your bag <small>Continue to checkout →</small></button>
          : <p className="menu-note">Your bag is empty. Design something to fill it.</p>}
        {enabled && <button onClick={signIn}>{user ? 'My designs & orders' : 'Sign in'}</button>}
        <p className="menu-foot">Custom clothing made by you.</p>
      </nav>
    </div>,
    document.body,
  )
}

export default function Header({ cartCount = 0, step, secure = false, onBag = () => {} }) {
  const [menu, setMenu] = useState(false)
  // the bag: straight to checkout if something's in it, otherwise the menu explains it's empty
  const bag = () => (cartCount > 0 ? onBag() : setMenu(true))
  return (
    <header className="header">
      <a className="logo" href="#">Unfolding People</a>
      {step && (
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>
              <b>{i + 1}</b>{s}
            </li>
          ))}
        </ol>
      )}
      {secure ? (
        <div className="nav-right secure-badge">
          <svg width="13" height="15" viewBox="0 0 14 16" fill="currentColor">
            <path d="M3 7V5a4 4 0 0 1 8 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm2 0h4V5a2 2 0 0 0-4 0z" />
          </svg>
          Secure checkout
        </div>
      ) : (
      <div className="nav-right">
        <AccountButton />
        <button className="bag" aria-label={cartCount ? 'Bag, continue to checkout' : 'Bag, empty'} onClick={bag}>
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="#fff" strokeWidth="1.5">
            <path d="M2 6h16l-1 14H3L2 6z" />
            <path d="M6.5 8V5a3.5 3.5 0 0 1 7 0v3" />
          </svg>
          ({cartCount})
        </button>
        <button className="burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(true)}><span /></button>
      </div>
      )}
      {menu && <Menu onClose={() => setMenu(false)} cartCount={cartCount} onBag={onBag} />}
    </header>
  )
}
