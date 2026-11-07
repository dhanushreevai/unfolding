import { useState } from "react";

/*
  Transitions between looks of the garment.
   - "turn": turning to another side. The old side squeezes away, the new side
     turns in. Only two copies are drawn, so it stays smooth.
   - "fold": new colour or garment. The new look unfolds over the old one in
     vertical paper strips (accordion).
  `live` is the real, editable garment. It is never re-created, so nothing resets.
  `still(state)` draws a light, non-interactive copy used only during the motion.
*/
export default function FoldSwap({ k, state, live, still, mode = "fold", dir = 1, strips = 6 }) {
  const [cur, setCur] = useState({ k, state });
  const [anim, setAnim] = useState(null);

  // a new look arrived: start the right motion from what is on screen now
  if (k !== cur.k) {
    setAnim({ prev: cur.state, mode, dir, id: (anim?.id || 0) + 1 });
    setCur({ k, state });
  }
  const done = e => e.target === e.currentTarget && setAnim(null);

  const turning = anim?.mode === "turn";
  const folding = anim?.mode === "fold";

  return (
    <div className="swap" style={{ "--dir": anim?.dir || 1 }}>
      <div className={`swap-live ${turning ? (anim.id % 2 ? "turn-in-a" : "turn-in-b") : ""} ${folding ? "hide" : ""}`}>{live}</div>

      {turning && (
        <div key={`out${anim.id}`} className="turn-out" onAnimationEnd={done}>
          {still(anim.prev)}
        </div>
      )}

      {folding && (
        <div key={`fold${anim.id}`} className="fold-layer">
          <div className="fold-under">{still(anim.prev)}</div>
          {Array.from({ length: strips }, (_, i) => (
            <div
              key={i}
              className={`strip ${i % 2 ? "odd" : "even"}`}
              style={{ left: `${(i * 100) / strips}%`, width: `${100 / strips}%`, animationDelay: `${i * 40}ms` }}
              onAnimationEnd={i === strips - 1 ? done : undefined}
            >
              <div className="strip-in" style={{ width: `${strips * 100}%`, left: `${-i * 100}%` }}>{still(cur.state)}</div>
              <span className="strip-shade" style={{ animationDelay: `${i * 40}ms` }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
