import Showcase from './Showcase.jsx'
import { Corners } from './Checkout.jsx'
import { formatPrice } from './garment.js'

const Icon = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  shirt: <path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3c0 2-2 3-4 3S8 5 8 3z" />,
  truck: <><path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z" /><circle cx="6" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" /></>,
  box: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
}

export default function Confirmation({ placed, customer, showcase, onDesignAnother }) {
  const when = new Date(placed.createdAt)
  const date = when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const steps = [
    { icon: 'check', title: 'Order Placed', note: `${date}\n${time}`, done: true },
    { icon: 'card', title: 'Payment', note: 'Secure link\nby email' },
    { icon: 'shirt', title: 'In Production', note: 'Once payment\nis received' },
    { icon: 'truck', title: 'Shipped', note: 'Tracking info\nvia email' },
    { icon: 'box', title: 'Delivered', note: 'To your doorstep' },
  ]

  return (
    <div className="confirm">
      <div className="confirm-check">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{Icon.check}</svg>
      </div>
      <p className="confirm-kicker">Order placed</p>
      <h1 className="confirm-title">You made it.</h1>
      <p className="confirm-id">Order #{placed.id}</p>
      <p className="confirm-text">
        Your order for {formatPrice(placed.totals.total)} is saved. We'll email <b>{customer.email}</b> a secure
        payment link — once it's paid, your custom piece goes straight into production.
      </p>

      <div className="confirm-stage">
        <Showcase {...showcase} thumbs="none" arrows={false} />
      </div>

      <ol className="timeline">
        {steps.map((s) => (
          <li key={s.title} className={s.done ? 'done' : ''}>
            <span className="timeline-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{Icon[s.icon]}</svg>
            </span>
            <b>{s.title}</b>
            <small>{s.note}</small>
          </li>
        ))}
      </ol>

      <div className="confirm-actions">
        <button className="pill ghost big" onClick={onDesignAnother}>Design another</button>
        <a className="pill light big" href="#">Continue shopping <span>→</span></a>
      </div>
      <Corners />
    </div>
  )
}
