import { BACK_PRINT_PRICE, PRODUCTS, formatPrice } from '../catalog.js'

const STEPS = [
  ['Design it', 'Upload your artwork, make it with ChatGPT, or add your own text and graphics.'],
  ['See it for real', 'Turn it round on a real photographed T-shirt or hoodie, in any of 11 colours.'],
  ['We print it for you', 'Every piece is printed to order and sent with tracked delivery.'],
]

const CARDS = [
  { key: 'tshirt', photo: '/tshirt.jpg', href: '#design-tshirt', cta: 'Design T-Shirt' },
  { key: 'hoodie', photo: '/hoodie.jpg', href: '#design-hoodie', cta: 'Design Hoodie' },
]

// What's below the home page hero: how it works, and the two garments.
export default function Explore() {
  return (
    <section className="explore" id="explore">
      <h2 className="explore-title">How it works</h2>
      <ol className="explore-steps">
        {STEPS.map(([title, text], i) => (
          <li key={title}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>

      <div className="explore-cards">
        {CARDS.map((c) => {
          const p = PRODUCTS[c.key]
          return (
            <a key={c.key} className="explore-card" href={c.href}>
              <img src={c.photo} alt={p.name} loading="lazy" draggable="false" />
              <div className="explore-card-text">
                <h3>{p.name}</h3>
                <p>{p.fabric}</p>
                <p>{formatPrice(p.price)} · back print +{formatPrice(BACK_PRINT_PRICE)}</p>
                <span className="btn">{c.cta} <span>→</span></span>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
