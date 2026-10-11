import Showcase from './Showcase.jsx'
import { formatPrice, printLabel, priceOrder } from './garment.js'

export function OrderSpecs({ product, color, size, layers, price, extra = null }) {
  return (
    <dl className="order-specs">
      <dt className="order-name">Custom {product.name}</dt>
      <dd className="order-price">{formatPrice(price)}</dd>
      <dt>Size</dt><dd>{size}</dd>
      <dt>Colour</dt><dd>{color.name}</dd>
      <dt>Print</dt><dd>{printLabel(layers)}</dd>
      {extra}
    </dl>
  )
}

export default function Review({ productKey, product, color, size, layers, previews, onPreviews, onEdit, onBuy }) {
  const { subtotal } = priceOrder({ product: productKey, layers, delivery: 'standard' })

  return (
    <div className="review">
      <Showcase product={product} color={color} layers={layers} thumbs="side" dashes
        thumbUrls={previews} onThumbs={onPreviews}
        top={<button className="back-link" onClick={onEdit}>← Edit design</button>} />

      <aside className="review-summary">
        <h1 className="looks-good">Looks good?</h1>
        <p className="review-sub">Review your custom piece<br />before you buy</p>

        <div className="order-card">
          <div className="order-top">
            <div className="order-thumb">{previews[0] && <img src={previews[0]} alt="" />}</div>
            <OrderSpecs product={product} color={color} size={size} layers={layers} price={subtotal}
              extra={<><dt>Fabric</dt><dd>{product.fabric}</dd></>} />
          </div>
          <div className="order-perks">
            <div className="perk">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z" /><circle cx="6" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" />
              </svg>
              <div><small>Estimated delivery</small><span>3–5 working days</span></div>
            </div>
            <div className="perk">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" />
              </svg>
              <div><small>30-day returns</small><span>No hassle</span></div>
            </div>
          </div>
        </div>

        <button className="pill light big buy" onClick={onBuy}>Buy Now <span>→</span></button>
        <div className="secure">
          <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
            <path d="M3 7V5a4 4 0 0 1 8 0v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm2 0h4V5a2 2 0 0 0-4 0z" />
          </svg>
          Secure checkout
        </div>
      </aside>
    </div>
  )
}
