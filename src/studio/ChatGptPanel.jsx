import { useState } from "react";

/*
  "Create with ChatGPT": the customer makes the artwork in their own ChatGPT (free or paid, no
  cost to the shop), then pastes it back here. We open chatgpt.com with a print-ready request
  already filled in; when the image is ready they copy it and paste it onto the garment.
*/

const STYLES = ["Streetwear", "Minimal", "Vintage", "Anime", "Cartoon", "Graffiti", "Line art", "Retro 80s"];

const requestFor = (idea, style, garment) =>
  [
    `Create a print-ready graphic for a ${garment}.`,
    `Idea: ${idea.trim() || "a bold, original design"}.`,
    style ? `Style: ${style}.` : "",
    "Show only the artwork, centred, on a transparent background (PNG). No t-shirt, no mockup, no frame, no watermark.",
    "Clean edges and strong shapes and colours that print well on fabric.",
  ].filter(Boolean).join(" ");

export default function ChatGptPanel({ garment, onPaste, pasteSupported }) {
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState("Streetwear");
  const [opened, setOpened] = useState(false);

  const open = () => {
    const q = encodeURIComponent(requestFor(idea, style, garment));
    window.open(`https://chatgpt.com/?q=${q}`, "_blank", "noopener");
    setOpened(true);
  };

  return (
    <div className="gpt">
      <p className="muted small">Make your artwork with your own ChatGPT, then paste it onto your {garment.toLowerCase()}.</p>

      <div className="gpt-step"><b>1</b><span>Describe your design</span></div>
      <textarea rows={3} placeholder="e.g. a tiger in sunglasses, my dog as a superhero, “STAY WILD” lettering…"
        value={idea} onChange={e => setIdea(e.target.value)} />
      <div className="gpt-styles">
        {STYLES.map(s => (
          <button key={s} className={style === s ? "on" : ""} onClick={() => setStyle(style === s ? "" : s)}>{s}</button>
        ))}
      </div>
      <button className="btn solid gpt-open" onClick={open}>
        <span>Create with ChatGPT</span><span aria-hidden="true">↗</span>
      </button>
      <p className="muted small">Opens ChatGPT in a new tab with your request ready. Need a photo of your own in it? Attach it in ChatGPT before sending.</p>

      <div className={`gpt-step ${opened ? "now" : ""}`}><b>2</b><span>Bring it back</span></div>
      <p className="muted small">
        When ChatGPT shows your image: <b>right-click → Copy image</b>, come back here and press <b>Ctrl+V</b>.
        On a phone, save the image and use <b>Upload</b>.
      </p>
      {pasteSupported && <button className="btn ghost gpt-paste" onClick={onPaste}>Paste image</button>}
    </div>
  );
}
