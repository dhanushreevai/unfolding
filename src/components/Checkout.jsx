import { useState } from 'react'
import Showcase from './Showcase.jsx'
import { OrderSpecs } from './Review.jsx'
import { COUNTRIES, DELIVERY, PAYMENT_METHODS, formatPrice, priceOrder } from './garment.js'
import { placeOrder } from '../orderApi.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAY_LINK = { card: 'card', paypal: 'PayPal', googlepay: 'Google Pay' }

export const emptyCustomer = {
  firstName: '', lastName: '', email: '', dial: '+44', phoneNumber: '',
  address: '', city: '', postcode: '', country: 'GB',
}

function validate(c) {
  const e = {}
  if (!c.firstName.trim()) e.firstName = 'Enter your first name'
  if (!c.lastName.trim()) e.lastName = 'Enter your last name'
  if (!EMAIL.test(c.email.trim())) e.email = 'Enter a valid email address'
  if ((c.phoneNumber.match(/\d/g) || []).length < 6) e.phone = 'Enter a valid phone number'
  if (!c.address.trim()) e.address = 'Enter your address'
  if (!c.city.trim()) e.city = 'Enter your city'
  if (!c.postcode.trim()) e.postcode = 'Enter your postcode'
  return e
}

const Lock = () => (
  <svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor">
    <path d="M3 7V5a4 4 0 0 1 8 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm2 0h4V5a2 2 0 0 0-4 0z" />
  </svg>
)

function Field({ label, error, className = '', children }) {
  return (
    <label className={`field-box${error ? ' invalid' : ''} ${className}`}>
      <span>{label}</span>
      {children}
      {error && <em>{error}</em>}
    </label>
  )
}

function Radio({ on }) {
  return <i className={`radio${on ? ' on' : ''}`} />
}

export function Corners() {
  return (
    <>
      <div className="corner l">Unfolding People<br />Custom clothing made by you</div>
      <div className="corner r">For a more<br />original tomorrow</div>
    </>
  )
}

/* ---------- step 3: details ---------- */

export function Details({ showcase, customer, setCustomer, delivery, setDelivery, onBack, onNext }) {
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => {
    const v = e.target.value
    setCustomer((c) => {
      const next = { ...c, [k]: v }
      // keep the dialling code in step with the chosen country until the user picks one
      if (k === 'country') next.dial = COUNTRIES.find((x) => x.code === v)?.dial || c.dial
      return next
    })
  }
  const submit = (e) => {
    e.preventDefault()
    const found = validate(customer)
    setErrors(found)
    if (Object.keys(found).length === 0) onNext()
  }

  return (
    <div className="checkout">
      <div className="checkout-visual">
        <Showcase {...showcase} thumbs="side" top={<button className="back-link" onClick={onBack}>← Back to review</button>} />
      </div>
      <form className="checkout-form" onSubmit={submit} noValidate>
        <h1 className="checkout-title">Your details</h1>
        <p className="checkout-sub">Almost there. Let's get this to you.</p>

        <div className="fields">
          <Field label="First Name *" error={errors.firstName}>
            <input value={customer.firstName} onChange={set('firstName')} autoComplete="given-name" />
          </Field>
          <Field label="Last Name *" error={errors.lastName}>
            <input value={customer.lastName} onChange={set('lastName')} autoComplete="family-name" />
          </Field>
          <Field label="Email Address *" error={errors.email} className="wide">
            <input type="email" value={customer.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Phone Number *" error={errors.phone} className="wide">
            <div className="phone">
              <select value={customer.dial} onChange={set('dial')} aria-label="Country code">
                {[...new Set(COUNTRIES.map((c) => c.dial))].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="tel" value={customer.phoneNumber} onChange={set('phoneNumber')} autoComplete="tel-national" />
            </div>
          </Field>
          <Field label="Address (House number and street) *" error={errors.address} className="wide">
            <input value={customer.address} onChange={set('address')} autoComplete="street-address" />
          </Field>
          <Field label="City *" error={errors.city}>
            <input value={customer.city} onChange={set('city')} autoComplete="address-level2" />
          </Field>
          <Field label="Postcode *" error={errors.postcode}>
            <input value={customer.postcode} onChange={set('postcode')} autoComplete="postal-code" />
          </Field>
          <Field label="Country *" className="wide select">
            <select value={customer.country} onChange={set('country')} autoComplete="country">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <h2 className="checkout-h2">Delivery <small>Fast. Reliable. Tracked.</small></h2>
        <div className="options-row">
          {Object.entries(DELIVERY).map(([key, d]) => (
            <button type="button" key={key} className={`option-card${delivery === key ? ' on' : ''}`} onClick={() => setDelivery(key)}>
              <Radio on={delivery === key} />
              <span className="option-text"><b>{d.label}</b><small>{d.eta}</small></span>
              <span className="option-price">{d.price ? formatPrice(d.price) : 'FREE'}</span>
            </button>
          ))}
        </div>

        <button type="submit" className="pill light big buy">Continue to payment <span>→</span></button>
        <p className="fine-print"><Lock /> Your details are only used to deliver your order.</p>
      </form>
      <Corners />
    </div>
  )
}

/* ---------- step 4: payment ---------- */

const Badges = {
  card: (
    <span className="badges">
      <i className="badge visa">VISA</i><i className="badge mc"><b /><b /></i><i className="badge amex">AMEX</i><i className="badge pay">Pay</i>
    </span>
  ),
  paypal: <span className="brand paypal"><b>Pay</b>Pal</span>,
  googlepay: <span className="brand gpay"><b>G</b> Pay</span>,
}

export function Payment({ showcase, order, onBack, onPlaced }) {
  const { productKey, product, color, size, layers, previews, customer, delivery, paymentMethod, setPaymentMethod } = order
  const totals = priceOrder({ product: productKey, layers, delivery })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const saved = await placeOrder({
        productKey, color, size, layers, delivery, paymentMethod, previews,
        customer: {
          firstName: customer.firstName, lastName: customer.lastName, email: customer.email,
          phone: `${customer.dial} ${customer.phoneNumber}`.trim(),
          address: customer.address, city: customer.city, postcode: customer.postcode, country: customer.country,
        },
      })
      onPlaced(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="checkout payment">
      <div className="checkout-visual">
        <Showcase {...showcase} thumbs="below" arrows={false} />
      </div>
      <div className="checkout-form">
        <button className="back-link" onClick={onBack}>← Edit details</button>
        <p className="step-of">Step 4 of 4</p>
        <h1 className="checkout-title">Payment</h1>
        <p className="checkout-sub">You're almost done.</p>

        <div className="order-card">
          <div className="order-top">
            <div className="order-thumb">{previews[0] && <img src={previews[0]} alt="" />}</div>
            <OrderSpecs product={product} color={color} size={size} layers={layers} price={totals.subtotal} />
          </div>
          <dl className="order-totals">
            <dt>Subtotal</dt><dd>{formatPrice(totals.subtotal)}</dd>
            <dt>Delivery ({delivery === 'express' ? 'Express' : 'Standard'})</dt>
            <dd>{totals.delivery ? formatPrice(totals.delivery) : 'FREE'}</dd>
            <dt className="grand">Total</dt><dd className="grand">{formatPrice(totals.total)}</dd>
          </dl>
        </div>

        <h2 className="checkout-h2">Payment method</h2>
        <div className="pay-methods">
          {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
            <button type="button" key={key} className={`option-card pay-row${paymentMethod === key ? ' on' : ''}`} onClick={() => setPaymentMethod(key)}>
              <Radio on={paymentMethod === key} />
              <span className="option-text"><b>{label}</b></span>
              {Badges[key]}
            </button>
          ))}
        </div>
        <p className="pay-note">
          No payment is taken today. We'll email a secure {PAY_LINK[paymentMethod]} payment link to <b>{customer.email}</b> to
          complete your order, and start printing once it's paid.
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="pill light big buy" onClick={submit} disabled={busy}>
          {busy ? 'Placing order…' : <>Place order · {formatPrice(totals.total)} <span>→</span></>}
        </button>
        <p className="fine-print"><Lock /> No card details are entered or stored on this page.</p>
      </div>
      <Corners />
    </div>
  )
}
