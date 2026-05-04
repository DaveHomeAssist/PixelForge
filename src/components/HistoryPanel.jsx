import { useRef } from "react";
import useFocusTrap from "../hooks/useFocusTrap.js";

export default function HistoryPanel({ open, undoN, redoN, onUndo, onRedo, onClose }) {
  const containerRef = useRef(null);
  useFocusTrap(open, containerRef, { restore: true, autoFocus: true, onEscape: onClose });

  if (!open) return null;
  return (
    <div
      ref={containerRef}
      className="pf-floating-panel pf-history-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pf-history-title"
    >
      <div className="pf-floating-head">
        <strong id="pf-history-title">History</strong>
        <button className="pf-icon-btn" type="button" onClick={onClose} aria-label="Close history">×</button>
      </div>
      <div className="pf-history-row">
        <span>Undo states</span>
        <strong>{undoN}</strong>
      </div>
      <div className="pf-history-row">
        <span>Redo states</span>
        <strong>{redoN}</strong>
      </div>
      <div className="pf-inline-actions">
        <button className="pf-layer-abtn" type="button" onClick={onUndo} disabled={undoN === 0}>Undo</button>
        <button className="pf-layer-abtn" type="button" onClick={onRedo} disabled={redoN === 0}>Redo</button>
      </div>
    </div>
  );
}
