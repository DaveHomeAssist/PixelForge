export default function NewDocumentModal({
  open,
  docForm,
  setDocForm,
  recentDocPresets,
  fieldFeedbackClass,
  feedbackClass,
  closeModal,
  applyNewDocument,
}) {
  if (!open) return null;

  return (
    <div className="pf-modal-backdrop" onClick={closeModal}>
      <div className="pf-modal" onClick={e => e.stopPropagation()}>
        <div className="pf-modal-head">
          <div className="pf-modal-title">New Document</div>
          <div className="pf-modal-copy">Set the canvas size and initial background color for a fresh document.</div>
        </div>
        <div className="pf-modal-body">
          {recentDocPresets.length > 0 && (
            <div className="pf-recent-row">
              {recentDocPresets.map((preset, index) => (
                <button
                  key={`${preset.width}-${preset.height}-${preset.background}-${index}`}
                  className="pf-chip-btn"
                  onClick={() => setDocForm({ width: preset.width, height: preset.height, background: preset.background })}
                >
                  {preset.width} × {preset.height}
                </button>
              ))}
            </div>
          )}
          <div className="pf-mini-grid">
            <input className="pf-input" type="number" min={64} max={8192} value={docForm.width} onChange={e => setDocForm(prev => ({ ...prev, width: e.target.value }))} aria-label="Document width" />
            <input className="pf-input" type="number" min={64} max={8192} value={docForm.height} onChange={e => setDocForm(prev => ({ ...prev, height: e.target.value }))} aria-label="Document height" />
          </div>
          <div className="pf-prop-row" style={{ marginTop: 12 }}>
            <span className="pf-prop-label">BG</span>
            <div className="pf-prop-val">
              <input className={`pf-input ${fieldFeedbackClass("doc-background")}`} value={docForm.background} onChange={e => setDocForm(prev => ({ ...prev, background: e.target.value }))} aria-label="Document background color" />
            </div>
          </div>
        </div>
        <div className="pf-modal-actions">
          <button className="pf-mbtn" onClick={closeModal}>Cancel</button>
          <button className={`pf-mbtn primary ${feedbackClass("new-doc")}`} onClick={applyNewDocument}>Create</button>
        </div>
      </div>
    </div>
  );
}
