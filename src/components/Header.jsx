export default function Header({ cartCount = 0 }) {
  return (
    <header className="header">
      <a className="logo" href="#">Unfolding People</a>
      <div className="nav-right">
        <button className="bag" aria-label="Bag">
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="#fff" strokeWidth="1.5">
            <path d="M2 6h16l-1 14H3L2 6z" />
            <path d="M6.5 8V5a3.5 3.5 0 0 1 7 0v3" />
          </svg>
          ({cartCount})
        </button>
        <button className="burger" aria-label="Menu"><span /></button>
      </div>
    </header>
  )
}
