import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { GARMENTS } from "./garments.js";
import { ClipartSvg, fontOf } from "./options.jsx";
import { recolouredUrl } from "./recolour.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/*
  Real garment photo recoloured like dyed fabric (see recolour.js): one finished image per
  photo and colour, so folds and fabric texture keep their real contrast in every colour.
*/
function useRecoloured(src, color) {
  const key = `${src}|${color}`;
  const [img, setImg] = useState({ key: null, url: null });
  useEffect(() => {
    let on = true;
    recolouredUrl(src, color).then(url => on && setImg({ key, url }));
    return () => { on = false; };
  }, [key]);
  // until the new colour is ready, keep showing the previous one (no flash of the grey photo)
  return img.url;
}

function Dyed({ src, color, alt = "" }) {
  const url = useRecoloured(src, color);
  return url ? <img className="dyed" src={url} alt={alt} draggable={false} /> : null;
}

export function PhotoGarment({ product, view, color }) {
  const src = GARMENTS[product].views[view].src;
  return (
    <div className="photo">
      <Dyed src={src} color={color} alt={`${GARMENTS[product].name} ${view}`} />
    </div>
  );
}

// One design layer: image, text or clipart
export function LayerContent({ l }) {
  if (l.kind === "image") return <img src={l.src} alt="" draggable={false} />;
  if (l.kind === "clip") return <ClipartSvg id={l.clip} color={l.color} />;
  const f = fontOf(l.font);
  return (
    <span
      className="txt"
      style={{
        fontFamily: f.css,
        fontWeight: f.weight,
        fontStyle: f.italic ? "italic" : "normal",
        color: l.color,
        fontSize: `${20 * (l.scale / 100)}cqw`,
      }}
    >
      {l.text || " "}
    </span>
  );
}
// Live size of the selected design in centimetres (like a tailor's chalk note)
function Dims({ cm, layer }) {
  const ref = useRef(null);
  const [txt, setTxt] = useState("");
  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    const area = el?.parentElement;
    if (!el || !area) return;
    const measure = () => {
      const w = (el.offsetWidth / area.offsetWidth) * cm[0];
      const h = (el.offsetHeight / area.offsetHeight) * cm[1];
      setTxt(`${w.toFixed(1)} × ${h.toFixed(1)} cm`);
    };
    measure();
    // an image's height is only known once it has loaded: measure again when it changes size
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });
  return <span ref={ref} className="dims" style={{ transform: `translateX(-50%) rotate(${-layer.rotate}deg)` }}>{txt}</span>;
}

/*
  "Ink" filter: makes the design look printed into the fabric.
  It reads the garment photo under the print area and darkens the design in the creases and
  lets highlights through (multiply with the fabric shading, which also carries the real cotton
  texture from the photo). Only the design pixels are affected, the shirt itself is untouched.
  (No displacement "bend": it shifts the whole design by the fabric's brightness, and with
  graphics-card rendering in Edge/Chrome that pushed prints towards the top-left corner.)
*/
function InkFilter({ id, src, print, boost, gamma = 1.35 }) {
  const { x, y, w, h } = print;
  const img = { x: -x / w, y: -y / h, width: 100 / w, height: 100 / h };
  return (
    <svg className="ink-defs" aria-hidden="true" width="0" height="0">
      <filter id={id} x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feImage href={src} {...img} preserveAspectRatio="none" result="fabric" />
        <feComponentTransfer in="fabric" result="light">
          <feFuncR type="gamma" amplitude={boost} exponent={gamma} offset="0" />
          <feFuncG type="gamma" amplitude={boost} exponent={gamma} offset="0" />
          <feFuncB type="gamma" amplitude={boost} exponent={gamma} offset="0" />
        </feComponentTransfer>
        <feBlend in="SourceGraphic" in2="light" mode="multiply" result="lit" />
        <feComposite in="lit" in2="SourceGraphic" operator="in" />
      </filter>
    </svg>
  );
}

const layerWidth = l => (l.kind === "text" ? "auto" : `${(l.kind === "image" ? 70 : 40) * (l.scale / 100)}%`);

/*
  Garment + the customer's design.
  editable -> drag to move, corners to resize, top dot to rotate.
*/
function Stage({ product, view, color, layers = [], editable = false, lite = false, selected, onSelect, onChange, onEmptyClick, className = "" }) {
  const areaRef = useRef(null);
  const fid = "ink" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = GARMENTS[product];
  const print = g.views[view].print;

  /*
    Keep every design inside the print area, as a real print would be: never larger than the
    area (Size slider, corner handles, or designs saved earlier) and never dragged past its
    edges. Measured from the real layer boxes, so it works for images, text and graphics, and
    accounts for rotation. Runs again when a layer changes size (e.g. an image finishes loading).
  */
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const keepInside = useCallback(() => {
    const area = areaRef.current;
    if (!editable || !area || !onChange) return;
    const aw = area.offsetWidth, ah = area.offsetHeight;
    if (!aw || !ah) return;
    for (const el of area.querySelectorAll(".layer.grab")) {
      const l = layersRef.current.find(x => x.id === el.dataset.id);
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!l || !w || !h) continue;
      const rad = (l.rotate * Math.PI) / 180;
      const bw = w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad)); // box after rotation
      const bh = w * Math.abs(Math.sin(rad)) + h * Math.abs(Math.cos(rad));
      const fit = Math.min(aw / bw, ah / bh);
      if (fit < 0.995) {
        onChange(l.id, { scale: Math.max(10, Math.floor(l.scale * fit)) }); // position is fixed on the next pass
        continue;
      }
      const hx = (bw / 2 / aw) * 100, hy = (bh / 2 / ah) * 100;
      const x = clamp(l.x, hx, 100 - hx), y = clamp(l.y, hy, 100 - hy);
      if (Math.abs(x - l.x) > 0.05 || Math.abs(y - l.y) > 0.05) onChange(l.id, { x, y });
    }
  }, [editable, onChange]);
  useLayoutEffect(() => { keepInside(); }, [layers, keepInside]);
  useEffect(() => {
    const area = areaRef.current;
    if (!editable || !area) return;
    const ro = new ResizeObserver(() => keepInside());
    area.querySelectorAll(".layer.grab").forEach(el => ro.observe(el));
    return () => ro.disconnect();
  }, [layers.length, editable, keepInside]);

  const start = (e, l, mode) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(l.id);
    const r = areaRef.current.getBoundingClientRect();
    const cx = r.left + (l.x / 100) * r.width;
    const cy = r.top + (l.y / 100) * r.height;
    const s = {
      px: e.clientX, py: e.clientY, x: l.x, y: l.y, scale: l.scale, rot: l.rotate,
      dist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1,
      ang: Math.atan2(e.clientY - cy, e.clientX - cx),
    };
    const move = ev => {
      if (mode === "move") {
        onChange(l.id, {
          x: clamp(s.x + ((ev.clientX - s.px) / r.width) * 100, 0, 100),
          y: clamp(s.y + ((ev.clientY - s.py) / r.height) * 100, 0, 100),
        });
      } else if (mode === "scale") {
        onChange(l.id, { scale: Math.round(clamp((s.scale * Math.hypot(ev.clientX - cx, ev.clientY - cy)) / s.dist, 10, 300)) });
      } else {
        let deg = s.rot + ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - s.ang) * 180) / Math.PI;
        deg = ((((deg + 180) % 360) + 360) % 360) - 180;
        if (Math.abs(deg) < 4) deg = 0; // snap straight
        onChange(l.id, { rotate: Math.round(deg) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={`stage ${editable ? "editable" : ""} ${className}`}
      style={{ aspectRatio: g.ratio }}
      onPointerDown={() => editable && onSelect(null)}
    >
      <PhotoGarment product={product} view={view} color={color} />
      {print && (
        <div
          className={`print-area ${layers.length ? "" : "empty"} ${selected && layers.some(l => l.id === selected) ? "active" : ""}`}
          ref={areaRef}
          style={{ left: `${print.x}%`, top: `${print.y}%`, width: `${print.w}%`, height: `${print.h}%` }}
        >
          {editable && <span className="area-tag">Print area · {print.cm[0]} × {print.cm[1]} cm</span>}
          {editable && layers.length === 0 && (
            <button className={`placeholder ${g.views[view].over ? "below-strings" : ""}`} onPointerDown={e => e.stopPropagation()} onClick={onEmptyClick}>
              + Add your design
            </button>
          )}
          {/* what you see: the design as ink in the fabric */}
          {layers.length > 0 && (
            <>
              {!lite && <InkFilter id={fid} src={g.views[view].src} print={print} boost={g.inkBoost} gamma={g.inkGamma} />}
              <div className="ink" style={lite ? undefined : { filter: `url(#${fid})` }}>
                {layers.map(l => (
                  <div key={l.id} className="layer" style={{ left: `${l.x}%`, top: `${l.y}%`, width: layerWidth(l), transform: `translate(-50%, -50%) rotate(${l.rotate}deg)` }}>
                    <LayerContent l={l} />
                  </div>
                ))}
              </div>
            </>
          )}
          {/* invisible copy on top that you grab, with the handles */}
          {editable && layers.map(l => {
            const sel = selected === l.id;
            return (
              <div
                key={l.id}
                data-id={l.id}
                className={`layer grab ${sel ? "sel" : ""}`}
                style={{ left: `${l.x}%`, top: `${l.y}%`, width: layerWidth(l), transform: `translate(-50%, -50%) rotate(${l.rotate}deg)` }}
                onPointerDown={e => start(e, l, "move")}
              >
                <span className="ghost"><LayerContent l={l} /></span>
                {sel && (
                  <>
                    {["tl", "tr", "bl", "br"].map(c => (
                      <span key={c} className={`handle ${c}`} onPointerDown={e => start(e, l, "scale")} />
                    ))}
                    <span className="rot-line" />
                    <span className="rot" title="Drag to rotate" onPointerDown={e => start(e, l, "rotate")} />
                    <Dims cm={print.cm} layer={l} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* parts of the garment that sit on top of the print (drawstrings) */}
      {print && layers.length > 0 && g.views[view].over && (
        <div className="photo over">
          <Dyed src={g.views[view].over} color={color} />
        </div>
      )}
    </div>
  );
}

export default memo(Stage);
