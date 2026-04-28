import { ChevronDown, ChevronRight } from "lucide-react";
import { BRUSH_PRESETS } from "../brushes.js";

export default function ToolSettingsSection({
  panelToolCopy,
  panelToolMeta,
  hoverToolMeta,
  tool,
  toolMeta,
  activeLayer,
  toolCompatible,
  suggestedLayer,
  focusLayerId,
  recentBrushSizes,
  setBrushSize,
  brushSize,
  brushOpacity,
  setBrushOpacity,
  brushPreset,
  setBrushPreset,
  bucketTolerance,
  setBucketTolerance,
  fillOn,
  setFillOn,
  strokeOn,
  setStrokeOn,
  strokeW,
  setStrokeW,
  collapsed = false,
  onToggle,
}) {
  return (
    <div className="pf-section">
      <button type="button" className="pf-section-head pf-section-toggle" onClick={onToggle} aria-expanded={!collapsed}>
        <span>Tool Settings</span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && <div className="pf-section-body">
        <div className="pf-tool-summary">
          <div>
            <div className="pf-tool-summary-title">{panelToolCopy.title}</div>
            <div className="pf-tool-summary-body">{panelToolCopy.description}</div>
            <div className="pf-tool-summary-hint">{panelToolCopy.hint}</div>
            {hoverToolMeta && hoverToolMeta.id !== tool && (
              <div className="pf-field-help" style={{ marginTop: 10 }}>
                Previewing <strong>{hoverToolMeta.label}</strong>. Click to switch.
              </div>
            )}
          </div>
          <span className="pf-kbd">{panelToolMeta.shortcut}</span>
        </div>

        {!toolCompatible && activeLayer && (
          <div className="pf-field-help warn">
            {toolMeta.label} works on {toolMeta.raster && toolMeta.vector ? "all" : toolMeta.raster ? "raster" : "vector"} layers. The current layer is {activeLayer.type}.
            {suggestedLayer && (
              <>
                {" "}
                <strong>{suggestedLayer.name}</strong> is the likely target.
                {" "}
                <button className="pf-chip-btn" style={{ marginTop: 8 }} onClick={() => focusLayerId(suggestedLayer.id)}>
                  Switch To {suggestedLayer.name}
                </button>
              </>
            )}
          </div>
        )}

        {tool === "bucket" && (
          <div className="pf-prop-row">
            <span className="pf-prop-label">Tolerance</span>
            <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="range" className="pf-slider" min={0} max={255} value={bucketTolerance} onChange={e => setBucketTolerance(+e.target.value)} />
              <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 28, textAlign: "right" }}>{bucketTolerance}</span>
            </div>
          </div>
        )}

        {["brush", "eraser"].includes(tool) && (
          <>
            <div className="pf-brush-presets" role="group" aria-label="Brush preset">
              {BRUSH_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={`pf-chip-btn ${brushPreset === preset.id ? "active" : ""}`}
                  onClick={() => setBrushPreset(preset.id)}
                  aria-pressed={brushPreset === preset.id}
                  aria-label={`${preset.label} brush`}
                  title={preset.label}
                >
                  <span aria-hidden="true" style={{ marginRight: 4 }}>{preset.symbol}</span>
                  {preset.label}
                </button>
              ))}
            </div>
            {recentBrushSizes.length > 0 && (
              <div className="pf-recent-row">
                {recentBrushSizes.map(size => (
                  <button key={size} className="pf-chip-btn" onClick={() => setBrushSize(+size)}>{size}px</button>
                ))}
              </div>
            )}
            <div className="pf-prop-row">
              <span className="pf-prop-label">Size</span>
              <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="range" className="pf-slider" min={1} max={200} value={brushSize} onChange={e => setBrushSize(+e.target.value)} />
                <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 28, textAlign: "right" }}>{brushSize}</span>
              </div>
            </div>
            <div className="pf-prop-row">
              <span className="pf-prop-label">Opacity</span>
              <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="range" className="pf-slider" min={0} max={100} value={Math.round(brushOpacity * 100)} onChange={e => setBrushOpacity(e.target.value / 100)} />
                <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 28, textAlign: "right" }}>{Math.round(brushOpacity * 100)}%</span>
              </div>
            </div>
            <div className="pf-field-help">Brush opacity and size carry across both paint and erase modes.</div>
          </>
        )}

        {["rect", "ellipse", "line", "polygon", "star", "pen"].includes(tool) && (
          <>
            <div className="pf-prop-row">
              <label className="pf-checkbox-row"><input type="checkbox" checked={fillOn} onChange={e => setFillOn(e.target.checked)} /><span>Fill</span></label>
              {!["line", "pen"].includes(tool) && <label className="pf-checkbox-row" style={{ marginLeft: 12 }}><input type="checkbox" checked={strokeOn} onChange={e => setStrokeOn(e.target.checked)} /><span>Stroke</span></label>}
            </div>
            <div className="pf-prop-row">
              <span className="pf-prop-label">Width</span>
              <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="range" className="pf-slider" min={1} max={40} value={strokeW} onChange={e => setStrokeW(+e.target.value)} />
                <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 20, textAlign: "right" }}>{strokeW}</span>
              </div>
            </div>
            <div className="pf-field-help">Primary color fills the shape. Secondary color is used for outlines when stroke is enabled.</div>
          </>
        )}
      </div>}
    </div>
  );
}
