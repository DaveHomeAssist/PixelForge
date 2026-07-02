import { ChevronDown, ChevronRight } from "lucide-react";

export default function HistorySection({
  undoN,
  redoN,
  onUndo,
  onRedo,
  collapsed = false,
  onToggle,
}) {
  return (
    <div className="pf-section pf-history-section">
      <button type="button" className="pf-section-head pf-section-toggle" onClick={onToggle} aria-expanded={!collapsed}>
        <span>History</span>
        <span className="pf-section-head-meta">
          <span>{undoN} undo</span>
          <span>{redoN} redo</span>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {!collapsed && (
        <div className="pf-section-body">
          <div className="pf-history-stack">
            <div className="pf-history-row">
              <span>Undo states</span>
              <strong>{undoN}</strong>
            </div>
            <div className="pf-history-row">
              <span>Redo states</span>
              <strong>{redoN}</strong>
            </div>
          </div>
          <div className="pf-inline-actions">
            <button className="pf-layer-abtn" type="button" onClick={onUndo} disabled={undoN === 0}>Undo</button>
            <button className="pf-layer-abtn" type="button" onClick={onRedo} disabled={redoN === 0}>Redo</button>
          </div>
          <div className="pf-field-help">History is capped to protect browser memory during long drawing sessions.</div>
        </div>
      )}
    </div>
  );
}
