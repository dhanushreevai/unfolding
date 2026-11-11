import { useCallback, useEffect, useRef, useState } from "react";
import Stage from "./Stage.jsx";
import FoldSwap from "./FoldSwap.jsx";
import ChatGptPanel from "./ChatGptPanel.jsx";
import { BACK_PRINT_PRICE, GARMENTS, VIEWS, VIEW_LABEL, priceOf } from "./garments.js";
import { CLIPART, COLOURS, ClipartSvg, FONTS, INKS, SIZES, colourName, fontOf, isDark } from "./options.jsx";
import { formatPrice } from "../catalog.js";

const uid = () => Math.random().toString(36).slice(2, 9);

// Read an uploaded image, shrink big photos, keep PNG transparency
export function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("That's not an image file."));
    if (file.size > 10 * 1024 * 1024) return reject(new Error("That image is over 10 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      if (file.type === "image/svg+xml") return resolve(reader.result);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1400 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s);
        cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        resolve(file.type === "image/jpeg" ? cv.toDataURL("image/jpeg", 0.9) : cv.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Could not open that image."));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const I = {
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
  chatgpt: <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />,
  text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  graphics: <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />,
  layers: <path d="M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5" />,
};
const Icon = ({ d, s = 20 }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const TOOLS = [["chatgpt", "ChatGPT"], ["upload", "Upload"], ["text", "Text"], ["graphics", "Graphics"], ["layers", "Layers"]];
const layerLabel = l => (l.kind === "text" ? `“${l.text.replace(/\n/g, " ")}”` : l.kind === "image" ? "Your image" : l.clip[0].toUpperCase() + l.clip.slice(1));

// The design studio. The garment (T-shirt or hoodie) is chosen by the page; Continue goes to review.
export default function Editor({ design, setDesign, size, setSize, onContinue, onMessage, message, onSave, saveLabel }) {
  const [view, setView] = useState("front");
  const [tool, setTool] = useState("chatgpt");
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState({ text: "", font: "Anton" });
  const [spinning, setSpinning] = useState(false);
  const wrapRef = useRef(null);
  // (switched off: tilting a flat photo in 3D skews it and makes it look rendered, not real)
  const setTilt = () => {};
  const fileRef = useRef(null);
  const turnRef = useRef(null);
  const lastLook = useRef({ product: design.product, color: design.color, view: "front" });
  useEffect(() => {
    lastLook.current = { product: design.product, color: design.color, view };
  });

  // load every garment photo up front so turning never waits for a download
  useEffect(() => {
    Object.values(GARMENTS).forEach(g =>
      Object.values(g.views).forEach(v =>
        [v.src, v.over].filter(Boolean).forEach(u => {
          const img = new Image();
          img.src = u;
          img.decode?.().catch(() => {});
        })
      )
    );
  }, []);

  const g = GARMENTS[design.product];
  const printable = !!g.views[view].print;
  const side = printable ? view : "front";
  const sel = design.layers[view]?.find(l => l.id === selected);
  const contrast = isDark(design.color) ? "#ffffff" : "#111111";
  const price = priceOf(design);
  const allCount = design.layers.front.length + design.layers.back.length;

  const go = useCallback(v => {
    setView(v);
    setSelected(null);
  }, []);
  const step = d => go(VIEWS[(VIEWS.indexOf(view) + d + 4) % 4]);

  const setLayers = useCallback((s, fn) => setDesign(d => ({ ...d, layers: { ...d.layers, [s]: fn(d.layers[s]) } })), [setDesign]);
  const update = useCallback((id, patch) => setLayers(view, ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l))), [setLayers, view]);
  const remove = id => {
    setLayers(view, ls => ls.filter(l => l.id !== id));
    setSelected(null);
  };
  const add = l => {
    if (!printable) go("front");
    const count = design.layers[side].length;
    const nl = { id: uid(), x: 50, y: count ? [30, 62, 46, 78, 20][(count - 1) % 5] : 45, scale: 100, rotate: 0, ...l };
    setLayers(side, ls => [...ls, nl]);
    setSelected(nl.id);
  };
  const duplicate = () => {
    if (!sel) return;
    const nl = { ...sel, id: uid(), x: Math.min(100, sel.x + 6), y: Math.min(100, sel.y + 6) };
    setLayers(view, ls => [...ls, nl]);
    setSelected(nl.id);
  };

  const upload = useCallback(async file => {
    try {
      const src = await readImage(file);
      add({ kind: "image", src, scale: 90 });
      onMessage("Image placed. Drag it, pull a corner to resize.");
    } catch (e) {
      onMessage(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, view]);

  // paste an image from the clipboard (e.g. copied from ChatGPT): Ctrl+V anywhere on the page
  useEffect(() => {
    const paste = e => {
      const target = e.composedPath?.()[0] || e.target;
      if (target.closest?.("input, textarea")) return;
      const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith("image/"));
      if (file) { e.preventDefault(); upload(file); }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [upload]);
  const pasteSupported = !!navigator.clipboard?.read;
  const pasteFromButton = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          return upload(new File([blob], "pasted.png", { type }));
        }
      }
      onMessage("No image copied yet. In ChatGPT: right-click the image → Copy image.");
    } catch {
      onMessage("Paste was blocked. Press Ctrl+V instead, or save the image and use Upload.");
    }
  };

  // drop an image anywhere on the page
  useEffect(() => {
    const over = e => e.preventDefault();
    const drop = e => {
      e.preventDefault();
      if (e.dataTransfer?.files?.[0]) upload(e.dataTransfer.files[0]);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [upload]);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    ["left", "back", "right", "front"].forEach((v, k, a) =>
      setTimeout(() => { go(v); if (k === a.length - 1) setSpinning(false); }, 700 * (k + 1))
    );
  };

  // keyboard: Delete removes, arrows nudge (or turn the garment when nothing is selected)
  useEffect(() => {
    const onKey = e => {
      // inside the isolated studio the event target is the host element, so read the real one
      const target = e.composedPath?.()[0] || e.target;
      if (target.closest?.("input, textarea, select")) return;
      if (!sel) {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(sel.id); }
      const n = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (n) { e.preventDefault(); update(sel.id, { x: sel.x + n[0], y: sel.y + n[1] }); }
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (sel?.kind === "text") setTool("text");
  }, [sel?.id, sel?.kind]);

  // flatten the tilt while a design is selected, so dragging stays precise
  useEffect(() => {
    if (selected) setTilt(0, 0);
  }, [selected]);

  // drag the table sideways to turn the garment
  const tableDown = e => {
    const t = { x: e.clientX, done: false };
    turnRef.current = t;
    const move = ev => {
      const dx = ev.clientX - t.x;
      if (!t.done && Math.abs(dx) > 70) {
        t.done = true;
        setView(v => VIEWS[(VIEWS.indexOf(v) + (dx < 0 ? 1 : -1) + 4) % 4]);
        setSelected(null);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      turnRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const tableMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    if (selected || turnRef.current) return setTilt(0, 0);
    setTilt(((e.clientY - r.top) / r.height - 0.5) * -5, ((e.clientX - r.left) / r.width - 0.5) * 7);
  };

  const textTarget = sel?.kind === "text" ? sel : null;
  const inkTarget = sel && sel.kind !== "image" ? sel : null;
  const foldKey = `${design.product}|${view}|${design.color}`;
  // only the side changed -> quick "turn"; colour or garment changed -> paper "fold"
  const last = lastLook.current;
  const onlyTurned = last.product === design.product && last.color === design.color && last.view !== view;
  const turnDir = ((VIEWS.indexOf(view) - VIEWS.indexOf(last.view) + 4) % 4) === 3 ? -1 : 1;
  const still = s => <Stage product={s.product} view={s.view} color={s.color} layers={s.layers} lite />;

  return (
    <div className="table">
      {message && <p className="toast" key={message.k}>{message.text}</p>}

      {/* the big side label behind the garment */}
      <div className="side-word" aria-hidden="true" key={view}>{VIEW_LABEL[view]}</div>

      {/* ---------- garment ---------- */}
      <div
        className="table-centre"
        onPointerDown={tableDown}
        onPointerMove={tableMove}
        onPointerLeave={() => setTilt(0, 0)}
      >
        <div className="marks" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="garment-wrap" ref={wrapRef}>
          <FoldSwap
            k={foldKey}
            mode="turn"
            dir={onlyTurned ? turnDir : 0} /* new colour: a plain crossfade, no paper fold */
            state={{ product: design.product, view, color: design.color, layers: design.layers[view] || [] }}
            still={still}
            live={
              <Stage
                product={design.product}
                view={view}
                color={design.color}
                layers={design.layers[view] || []}
                editable
                selected={selected}
                onSelect={setSelected}
                onChange={update}
                onEmptyClick={() => { setTool("upload"); fileRef.current?.click(); }}
              />
            }
          />
        </div>
      </div>

      {/* ---------- selected design controls ---------- */}
      {sel && (
        <div className="sel-bar" key={sel.id}>
          {inkTarget && (
            <div className="inks">
              {INKS.map(c => (
                <button key={c} style={{ background: c }} className={inkTarget.color === c ? "on" : ""} aria-label={`Ink ${c}`} onClick={() => update(inkTarget.id, { color: c })} />
              ))}
              <label className="ink-any" title="Any colour"><input type="color" value={inkTarget.color} onChange={e => update(inkTarget.id, { color: e.target.value })} /></label>
            </div>
          )}
          <label className="slide"><span>Size</span><input type="range" min="10" max="300" value={sel.scale} onChange={e => update(sel.id, { scale: +e.target.value })} /></label>
          <label className="slide"><span>Turn</span><input type="range" min="-180" max="180" value={sel.rotate} onChange={e => update(sel.id, { rotate: +e.target.value })} /></label>
          <div className="sel-actions">
            <button onClick={() => update(sel.id, { x: 50 })}>Centre</button>
            <button onClick={duplicate}>Copy</button>
            <button className="danger" onClick={() => remove(sel.id)}>Delete</button>
          </div>
        </div>
      )}

      {/* ---------- tool dock + fold-out panel ---------- */}
      <nav className="dock" aria-label="Tools">
        {TOOLS.map(([k, label]) => (
          <button key={k} className={tool === k ? "on" : ""} onClick={() => setTool(t => (t === k ? null : k))} title={label}>
            <Icon d={I[k]} />
            <span>{label}</span>
            {k === "layers" && allCount > 0 && <em>{allCount}</em>}
          </button>
        ))}
      </nav>

      {tool && (
        <section className="panel" key={tool}>
          <button className="panel-x" onClick={() => setTool(null)} aria-label="Close panel">×</button>
          {tool === "chatgpt" && (
            <>
              <h3>Create with ChatGPT</h3>
              <ChatGptPanel garment={g.name} onPaste={pasteFromButton} pasteSupported={pasteSupported} />
            </>
          )}
          {tool === "upload" && (
            <>
              <h3>Your artwork</h3>
              <label className="dropzone">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { upload(e.target.files[0]); e.target.value = ""; }} />
                <span className="dz-icon"><Icon d={I.upload} s={22} /></span>
                <strong>Choose an image</strong>
                <span className="muted">or drop it anywhere on the screen</span>
                <span className="muted small">PNG · JPG · SVG · up to 10 MB</span>
              </label>
              <p className="muted small">It lands on the <b>{VIEW_LABEL[side].toLowerCase()}</b>. Turn to the back to print there too.</p>
            </>
          )}

          {tool === "text" && (
            <>
              <h3>{textTarget ? "Edit text" : "Write something"}</h3>
              <textarea
                rows={3}
                placeholder="Words worth wearing…"
                value={textTarget ? textTarget.text : text.text}
                onChange={e => (textTarget ? update(textTarget.id, { text: e.target.value }) : setText(t => ({ ...t, text: e.target.value })))}
              />
              <div className="font-list">
                {FONTS.map(f => {
                  const on = (textTarget ? textTarget.font : text.font) === f.name;
                  return (
                    <button
                      key={f.name}
                      className={on ? "on" : ""}
                      style={{ fontFamily: f.css, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal" }}
                      onClick={() => (textTarget ? update(textTarget.id, { font: f.name }) : setText(t => ({ ...t, font: f.name })))}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
              {textTarget ? (
                <button className="btn ghost" onClick={() => setSelected(null)}>Done</button>
              ) : (
                <button
                  className="btn solid"
                  disabled={!text.text.trim()}
                  onClick={() => {
                    add({ kind: "text", text: text.text.trim(), font: text.font, color: contrast, scale: 70 });
                    setText(t => ({ ...t, text: "" }));
                  }}
                >
                  Place on the {VIEW_LABEL[side].toLowerCase()}
                </button>
              )}
            </>
          )}

          {tool === "graphics" && (
            <>
              <h3>Graphics</h3>
              <div className="clip-grid">
                {CLIPART.map(c => (
                  <button key={c.id} aria-label={c.id} onClick={() => add({ kind: "clip", clip: c.id, color: contrast, scale: 70 })}>
                    <ClipartSvg id={c.id} />
                  </button>
                ))}
              </div>
            </>
          )}

          {tool === "layers" && (
            <>
              <h3>On the garment</h3>
              {allCount === 0 && <p className="muted">Nothing yet. Upload an image or write some text.</p>}
              {["front", "back"].map(s =>
                design.layers[s].length ? (
                  <div key={s} className="layer-group">
                    <p className="label">{VIEW_LABEL[s]}</p>
                    <ul>
                      {design.layers[s].map(l => (
                        <li key={l.id} className={selected === l.id ? "on" : ""}>
                          <button className="ln" style={l.kind === "text" ? { fontFamily: fontOf(l.font).css } : undefined} onClick={() => { if (view !== s) go(s); setTimeout(() => setSelected(l.id), 0); }}>
                            {layerLabel(l)}
                          </button>
                          <button className="lx" aria-label="Remove" onClick={() => { setLayers(s, ls => ls.filter(x => x.id !== l.id)); setSelected(null); }}>×</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </>
          )}
        </section>
      )}

      {/* ---------- turn bar ---------- */}
      <div className="turnbar">
        <button className="arrow" onClick={() => step(-1)} aria-label="Turn left">←</button>
        <div className="sides" data-i={VIEWS.indexOf(view)}>
          {VIEWS.map(v => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => go(v)}>{VIEW_LABEL[v]}</button>
          ))}
          <span className="sides-mark" />
        </div>
        <button className="arrow" onClick={() => step(1)} aria-label="Turn right">→</button>
        <button className={`spin ${spinning ? "on" : ""}`} onClick={spin}>360°</button>
      </div>
      {!printable && <p className="side-hint">Side view · prints go on the front and back</p>}

      {/* ---------- order ---------- */}
      <aside className="order">
        <a className="change-product" href="#">← Change product</a>
        <h2 className="piece-name">{g.name}</h2>
        <p className="label">{g.tagline}</p>

        <div className="row"><span className="label">Colour</span><span className="small">{colourName(design.color)}</span></div>
        <div className="swatches">
          {COLOURS.map(c => (
            <button key={c.hex} style={{ background: c.hex }} className={design.color === c.hex ? "on" : ""} title={c.name} aria-label={c.name} onClick={() => setDesign(d => ({ ...d, color: c.hex }))} />
          ))}
        </div>

        <div className="row"><span className="label">Size</span><span className="small">{size}</span></div>
        <div className="sizes">
          {SIZES.map(s => <button key={s} className={size === s ? "on" : ""} onClick={() => setSize(s)}>{s}</button>)}
        </div>

        <div className="price-line">
          <strong>{formatPrice(price)}</strong>
          <span className="muted small">
            {g.name} {formatPrice(g.price)}{design.layers.back.length ? ` + back ${formatPrice(BACK_PRINT_PRICE)}` : ""}
          </span>
        </div>
        <button
          className="btn accent big"
          disabled={allCount === 0}
          onClick={() => { setSelected(null); onContinue(); }}
        >
          <span>{allCount === 0 ? "Add a design first" : "Continue"}</span>
          <span className="plus" aria-hidden="true">→</span>
        </button>
        {onSave && (
          <button className="btn ghost save-btn" disabled={allCount === 0} onClick={() => { setSelected(null); onSave(); }}>
            <span>{saveLabel || "Save to my designs"}</span>
          </button>
        )}
      </aside>
    </div>
  );
}
