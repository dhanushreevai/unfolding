const STEPS = ['Design', 'Review', 'Details', 'Payment']

export default function Header({ cartCount = 0, step, secure = false }) {
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
        <button className="bag" aria-label="Bag">
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="#fff" strokeWidth="1.5">
            <path d="M2 6h16l-1 14H3L2 6z" />
            <path d="M6.5 8V5a3.5 3.5 0 0 1 7 0v3" />
          </svg>
          ({cartCount})
        </button>
        <button className="burger" aria-label="Menu"><span /></button>
      </div>
      )}
    </header>
  )
}
