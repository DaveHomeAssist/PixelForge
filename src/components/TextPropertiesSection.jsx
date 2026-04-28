import { ChevronDown, ChevronRight } from "lucide-react";
import { FONT_FAMILIES } from "../text.js";

export default function TextPropertiesSection({ activeLayer, updateTextLayer, startEditingText, collapsed = false, onToggle }) {
  if (!activeLayer || activeLayer.type !== "text") return null;
  const id = activeLayer.id;
  const patch = (partial) => updateTextLayer(id, partial);

  return (
    <div className="pf-section">
      <button type="button" className="pf-section-head pf-section-toggle" onClick={onToggle} aria-expanded={!collapsed}>
        <span>Text</span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && <div className="pf-section-body">
        <button
          type="button"
          className="pf-chip-btn"
          onClick={() => startEditingText?.(id)}
          style={{ marginBottom: 8 }}
        >
          Edit Text
        </button>

        <div className="pf-prop-row">
          <span className="pf-prop-label">Font</span>
          <div className="pf-prop-val">
            <select
              value={activeLayer.fontFamily}
              onChange={e => patch({ fontFamily: e.target.value })}
              aria-label="Font family"
            >
              {FONT_FAMILIES.map(f => (
                <option key={f.id} value={f.css}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pf-prop-row">
          <span className="pf-prop-label">Size</span>
          <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              className="pf-slider"
              min={8}
              max={256}
              value={activeLayer.fontSize}
              onChange={e => patch({ fontSize: +e.target.value })}
              aria-label="Font size"
            />
            <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 34, textAlign: "right" }}>{activeLayer.fontSize}px</span>
          </div>
        </div>

        <div className="pf-prop-row">
          <span className="pf-prop-label">Weight</span>
          <div className="pf-prop-val">
            <button
              type="button"
              className={`pf-chip-btn ${activeLayer.fontWeight === 400 ? "active" : ""}`}
              onClick={() => patch({ fontWeight: 400 })}
              aria-pressed={activeLayer.fontWeight === 400}
            >Regular</button>
            <button
              type="button"
              className={`pf-chip-btn ${activeLayer.fontWeight === 700 ? "active" : ""}`}
              onClick={() => patch({ fontWeight: 700 })}
              aria-pressed={activeLayer.fontWeight === 700}
              style={{ marginLeft: 6 }}
            >Bold</button>
            <button
              type="button"
              className={`pf-chip-btn ${activeLayer.italic ? "active" : ""}`}
              onClick={() => patch({ italic: !activeLayer.italic })}
              aria-pressed={!!activeLayer.italic}
              style={{ marginLeft: 6 }}
            >Italic</button>
          </div>
        </div>

        <div className="pf-prop-row">
          <span className="pf-prop-label">Color</span>
          <div className="pf-prop-val">
            <input
              type="color"
              value={activeLayer.color}
              onChange={e => patch({ color: e.target.value })}
              aria-label="Text color"
            />
          </div>
        </div>

        <div className="pf-prop-row">
          <span className="pf-prop-label">Align</span>
          <div className="pf-prop-val">
            {["left", "center", "right"].map(a => (
              <button
                key={a}
                type="button"
                className={`pf-chip-btn ${activeLayer.align === a ? "active" : ""}`}
                onClick={() => patch({ align: a })}
                aria-pressed={activeLayer.align === a}
                style={{ marginRight: 4 }}
              >{a}</button>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}
