import { useEffect, useState } from "react";

export default function StatusBar({
  docW,
  docH,
  zoom,
  activeLayer,
  toolMeta,
  isDirty,
  lastSavedAt,
  clipboardStatus,
}) {
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(pointer: coarse)");
    if (!media) return undefined;
    const sync = () => setIsCoarsePointer(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  return (
    <div className="pf-status">
      <span>{docW} × {docH}</span>
      <span className="pf-status-accent">{(zoom * 100).toFixed(0)}%</span>
      {activeLayer && <span>{activeLayer.name} <span style={{ color: "#c8b9a8" }}>|</span> {activeLayer.type === "raster" ? "RASTER" : "VECTOR"}</span>}
      <span>{toolMeta.label}</span>
      {clipboardStatus && <span className="pf-status-accent">Clipboard {clipboardStatus}</span>}
      <span>{isDirty ? "Unsaved draft" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Ready"}</span>
      {isCoarsePointer ? (
        <button className="pf-status-help" type="button" onClick={() => setHelpOpen(true)} aria-label="Open gesture help">?</button>
      ) : (
        <span className="pf-status-hints">Space drag pans · Scroll zooms · Cmd+V pastes · X swaps colors · [ ] resizes brush</span>
      )}
      {helpOpen && (
        <div className="pf-help-sheet" role="dialog" aria-modal="true" aria-label="Canvas help">
          <div className="pf-help-card">
            <div className="pf-modal-head">
              <div className="pf-modal-title">Canvas Help</div>
              <button className="pf-icon-btn" type="button" onClick={() => setHelpOpen(false)} aria-label="Close help">×</button>
            </div>
            <div className="pf-modal-body">
              <div className="pf-help-row"><strong>Touch</strong><span>Drag one finger to pan. Pinch with two fingers to zoom.</span></div>
              <div className="pf-help-row"><strong>Desktop</strong><span>Hold Space and drag to pan. Scroll to zoom. Cmd+V pastes. X swaps colors. [ ] changes brush size.</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
