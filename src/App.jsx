import Header from './components/Header.jsx'
import Product from './components/Product.jsx'
import Tshirt from './components/Tshirt.jsx'
import Hoodie from './components/Hoodie.jsx'

export default function App() {
  return (
    <>
    <section className="hero">
      <Header cartCount={0} />

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
    <footer className="footer">
      Partnered by <b>ZEVENX</b>
    </footer>
    </>
  )
}
