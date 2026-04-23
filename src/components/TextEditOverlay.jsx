import { useEffect, useRef, useState } from "react";
import { buildFontString } from "../text.js";

export default function TextEditOverlay({ layer, zoom, pan, onCommit, onCancel }) {
  const ref = useRef(null);
  const [value, setValue] = useState(layer?.text || "");

  useEffect(() => {
    if (!ref.current) return;
    ref.current.focus();
    ref.current.select();
  }, []);

  if (!layer) return null;

  const screenX = (layer.ox || 0) * zoom + pan.x;
  const screenY = (layer.oy || 0) * zoom + pan.y;
  const sizeCss = (layer.fontSize || 48) * zoom;

  const commit = () => {
    const trimmed = value;
    onCommit(trimmed);
  };

  const cancel = () => onCancel();

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === "Escape") { e.preventDefault(); cancel(); }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
      }}
      style={{
        position: "absolute",
        left: `${screenX}px`,
        top: `${screenY}px`,
        minWidth: "60px",
        minHeight: `${sizeCss * 1.2}px`,
        font: buildFontString(layer),
        fontSize: `${sizeCss}px`,
        color: layer.color,
        textAlign: layer.align || "left",
        background: "rgba(255,255,255,0.72)",
        border: "1px dashed rgba(42,111,151,0.72)",
        outline: "none",
        padding: "2px 4px",
        margin: 0,
        resize: "none",
        overflow: "hidden",
        whiteSpace: layer.maxWidth ? "pre-wrap" : "pre",
        zIndex: 10,
      }}
      rows={Math.max(1, (value.match(/\n/g)?.length || 0) + 1)}
      aria-label="Edit text layer"
    />
  );
}
