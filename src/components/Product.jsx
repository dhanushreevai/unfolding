export default function Product({ children, label, href }) {
  return (
    <div className="product">
      <div className="glow">{children}</div>
      <a className="btn" href={href}>{label} <span>→</span></a>
    </div>
  )
}
