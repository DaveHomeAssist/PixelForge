import { useRef } from "react";
import { RESIZE_ANCHORS } from "../constants.js";
import useFocusTrap from "../hooks/useFocusTrap.js";

export default function ResizeDocumentModal({
  open,
  resizeForm,
  setResizeForm,
  feedbackClass,
  closeModal,
  applyResizeCanvas,
}) {
  const containerRef = useRef(null);
  useFocusTrap(open, containerRef, { restore: true, autoFocus: true, onEscape: closeModal });

  if (!open) return null;

  return (
    <div className="pf-modal-backdrop" onClick={closeModal}>
      <div
        ref={containerRef}
        className="pf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-resize-doc-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="pf-modal-head">
          <div className="pf-modal-title" id="pf-resize-doc-title">Resize Canvas</div>
          <div className="pf-modal-copy">Resize the document and choose which anchor point stays fixed.</div>
        </div>
        <div className="pf-modal-body">
          <div className="pf-mini-grid">
            <input className="pf-input" type="number" min={64} max={8192} value={resizeForm.width} onChange={e => setResizeForm(prev => ({ ...prev, width: e.target.value }))} aria-label="Resize width" />
            <input className="pf-input" type="number" min={64} max={8192} value={resizeForm.height} onChange={e => setResizeForm(prev => ({ ...prev, height: e.target.value }))} aria-label="Resize height" />
          </div>
          <div className="pf-field-help" style={{ marginTop: 12, marginBottom: 10 }}>Anchor</div>
          <div className="pf-anchor-grid">
            {RESIZE_ANCHORS.flat().map(anchor => (
              <button key={anchor} className={`pf-anchor-btn ${resizeForm.anchor === anchor ? "active" : ""}`} onClick={() => setResizeForm(prev => ({ ...prev, anchor }))}>
                {anchor}
              </button>
            ))}
          </div>
        </div>
        <div className="pf-modal-actions">
          <button className="pf-mbtn" onClick={closeModal}>Cancel</button>
          <button className={`pf-mbtn primary ${feedbackClass("resize-doc")}`} onClick={applyResizeCanvas}>Apply</button>
        </div>
      </div>
    </div>
  );
}
