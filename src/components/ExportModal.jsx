import { useState } from "react";

export default function ExportModal({
  open,
  initialOptions,
  selectionAvailable,
  onClose,
  onExport,
}) {
  const [format, setFormat] = useState(initialOptions?.format || "png");
  const [quality, setQuality] = useState(initialOptions?.quality ?? 0.92);
  const [scale, setScale] = useState(initialOptions?.scale || 1);
  const [customScale, setCustomScale] = useState(initialOptions?.scale || 1);
  const [includeBackground, setIncludeBackground] = useState(initialOptions?.includeBackground ?? true);
  const [selectedOnly, setSelectedOnly] = useState(!!initialOptions?.selectedOnly && selectionAvailable);
  const [filename, setFilename] = useState(initialOptions?.filename || "pixelforge-export");

  if (!open) return null;
  const resolvedScale = scale === "custom" ? Number(customScale) || 1 : Number(scale);
  const submit = () => {
    onExport({
      format,
      quality,
      scale: resolvedScale,
      includeBackground,
      selectedOnly: selectedOnly && selectionAvailable,
      filename: filename.trim() || "pixelforge-export",
    });
  };

  return (
    <div className="pf-modal-backdrop" role="dialog" aria-modal="true" aria-label="Export options">
      <div className="pf-modal" style={{ maxWidth: 480 }}>
        <div className="pf-modal-head">
          <div className="pf-modal-title">Export</div>
          <button className="pf-icon-btn" type="button" onClick={onClose} aria-label="Close export options">×</button>
        </div>
        <div className="pf-modal-body">
          <div className="pf-export-grid">
            <label>
              <span>Format</span>
              <select className="pf-select" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WebP</option>
              </select>
            </label>
            <label>
              <span>Scale</span>
              <select className="pf-select" value={scale} onChange={e => setScale(e.target.value)}>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {scale === "custom" && (
              <label>
                <span>Custom Scale</span>
                <input className="pf-input" type="number" min="0.1" max="8" step="0.1" value={customScale} onChange={e => setCustomScale(e.target.value)} />
              </label>
            )}
            {format !== "png" && (
              <label>
                <span>Quality</span>
                <input className="pf-slider" type="range" min="0.2" max="1" step="0.01" value={quality} onChange={e => setQuality(+e.target.value)} />
              </label>
            )}
            <label>
              <span>Filename</span>
              <input className="pf-input" value={filename} onChange={e => setFilename(e.target.value)} />
            </label>
          </div>
          <div className="pf-inline-actions" style={{ marginTop: 14 }}>
            <label className="pf-checkbox-row"><input type="checkbox" checked={includeBackground} onChange={e => setIncludeBackground(e.target.checked)} /><span>Include Background</span></label>
            <label className={`pf-checkbox-row ${!selectionAvailable ? "muted" : ""}`}><input type="checkbox" checked={selectedOnly} disabled={!selectionAvailable} onChange={e => setSelectedOnly(e.target.checked)} /><span>Selected Region Only</span></label>
          </div>
        </div>
        <div className="pf-modal-actions">
          <button type="button" className="pf-chip-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="pf-chip-btn active" onClick={submit}>Export</button>
        </div>
      </div>
    </div>
  );
}
