import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  deleteDesign, displayName, listDesigns, listOrders, signInWithEmail, signInWithGoogle, signOut, useAuth,
} from '../auth.jsx'
import { formatPrice } from '../catalog.js'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
)

function SignIn({ onClose }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sendLink = async (e) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address')
    setBusy(true)
    setError('')
    const { error: err } = await signInWithEmail(email.trim())
    setBusy(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  const google = async () => {
    setError('')
    const { error: err } = await signInWithGoogle()
    if (err) setError(err.message)
  }

  return (
    <>
      <h2 className="acct-title">Sign in</h2>
      <p className="acct-sub">Save your designs and see your orders on any device.</p>
      {sent ? (
        <p className="acct-note">Check <b>{email}</b>: we've sent you a sign-in link. Open it on this device to continue.</p>
      ) : (
        <>
          <button className="pill light acct-btn" onClick={google}><GoogleIcon /> Continue with Google</button>
          <div className="acct-or"><span>or</span></div>
          <form onSubmit={sendLink} className="acct-form">
            <label className="field-box">
              <span>Email address</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <button className="pill ghost acct-btn" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
          </form>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
      <button className="acct-close-text" onClick={onClose}>Not now</button>
    </>
  )
}

function Profile({ user, onClose }) {
  const [tab, setTab] = useState('designs')
  const [designs, setDesigns] = useState(null)
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listDesigns().then(setDesigns).catch((e) => setError(e.message))
    listOrders().then(setOrders).catch((e) => setError(e.message))
  }, [])

  const open = (d) => {
    sessionStorage.setItem('up-open-design', d.id)
    onClose()
    window.location.hash = d.product === 'hoodie' ? 'design-hoodie' : 'design-tshirt'
    window.dispatchEvent(new Event('up-open-design'))
  }
  const remove = async (d) => {
    if (!window.confirm('Delete this design?')) return
    try { await deleteDesign(d.id); setDesigns((ds) => ds.filter((x) => x.id !== d.id)) } catch (e) { setError(e.message) }
  }

  return (
    <>
      <h2 className="acct-title">Hi, {displayName(user)}</h2>
      <p className="acct-sub">{user.email}</p>
      <div className="acct-tabs">
        <button className={tab === 'designs' ? 'on' : ''} onClick={() => setTab('designs')}>My designs</button>
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>My orders</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {tab === 'designs' && (
        designs === null ? <p className="acct-note">Loading…</p>
          : designs.length === 0 ? <p className="acct-note">No saved designs yet. Use <b>Save</b> in the design studio.</p>
            : (
              <ul className="acct-list">
                {designs.map((d) => (
                  <li key={d.id}>
                    <button className="acct-item" onClick={() => open(d)}>
                      {d.preview ? <img src={d.preview} alt="" /> : <span className="acct-ph" />}
                      <span><b>{d.name || (d.product === 'hoodie' ? 'Custom Hoodie' : 'Custom T-Shirt')}</b>
                        <small>{new Date(d.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small></span>
                    </button>
                    <button className="acct-x" onClick={() => remove(d)} aria-label="Delete design">×</button>
                  </li>
                ))}
              </ul>
            )
      )}
      {tab === 'orders' && (
        orders === null ? <p className="acct-note">Loading…</p>
          : orders.length === 0 ? <p className="acct-note">No orders yet.</p>
            : (
              <ul className="acct-list">
                {orders.map((o) => (
                  <li key={o.id} className="acct-order">
                    <span><b>#{o.id}</b><small>{o.product === 'hoodie' ? 'Hoodie' : 'T-Shirt'} · {o.colour} · {o.size}</small></span>
                    <span className="acct-order-r"><b>{formatPrice(Number(o.total))}</b><small>{o.status === 'awaiting_payment' ? 'Awaiting payment' : o.status}</small></span>
                  </li>
                ))}
              </ul>
            )
      )}
      <button className="pill ghost acct-btn" onClick={() => { signOut(); onClose() }}>Sign out</button>
    </>
  )
}

export default function AccountButton() {
  const { user, enabled } = useAuth()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('up-sign-in', show)
    return () => window.removeEventListener('up-sign-in', show)
  }, [])
  if (!enabled) return null

  return (
    <>
      <button className="acct-trigger" onClick={() => setOpen(true)} aria-label={user ? 'Your account' : 'Sign in'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
        <span>{user ? `Hi, ${displayName(user).split(' ')[0]}` : 'Sign in'}</span>
      </button>
      {/* rendered at page level, above the header and the design studio */}
      {open && createPortal(
        <div className="acct-scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="acct-panel" role="dialog" aria-modal="true">
            <button className="acct-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            {user ? <Profile user={user} onClose={() => setOpen(false)} /> : <SignIn onClose={() => setOpen(false)} />}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
