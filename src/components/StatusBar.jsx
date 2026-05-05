import { useEffect, useState } from "react";

/**
 * StatusBar
 *
 * PR 3 visual refresh of the existing status bar. The render is replaced to
 * match the design's grouped layout (active tool pill, dims, zoom, layer kind,
 * save state, plus right-side keyboard hints) but every state input from the
 * legacy version is preserved: docW/docH, zoom, activeLayer, toolMeta, isDirty,
 * lastSavedAt, clipboardStatus, and the coarse-pointer help sheet.
 */
export default function StatusBar({
  docW,
  docH,
  zoom,
  activeLayer,
  toolMeta,
  isDirty,
  lastSavedAt,
  clipboardStatus,
  tier2PreviewActive = false,
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

  const toolLabel = toolMeta?.label ? toolMeta.label.toUpperCase() : "—";
  const layerKind = activeLayer?.type === "raster" ? "raster" : (activeLayer?.type ? "vector" : null);
  const savedLabel = isDirty
    ? "UNSAVED"
    : lastSavedAt
      ? `SAVED ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "READY";

  return (
    <div className="pf-statusbar">
      <span className="pf-pill pf-pill-live">{toolLabel}</span>
      <span>{docW} × {docH}</span>
      <span>{(zoom * 100).toFixed(0)}%</span>
      {activeLayer && (
        <span>{activeLayer.name} · {layerKind || ""}</span>
      )}
      <span>{savedLabel}</span>
      {tier2PreviewActive && <span className="pf-status-badge">Tier 2 (preview)</span>}
      {clipboardStatus && (
        <span className="pf-pill" role="status" aria-live="polite">{clipboardStatus}</span>
      )}

      <div className="pf-status-right">
        {isCoarsePointer ? (
          <button className="pf-status-help" type="button" onClick={() => setHelpOpen(true)} aria-label="Open gesture help">?</button>
        ) : (
          <>
            <span className="pf-hint"><kbd>Space</kbd> drag pans</span>
            <span className="pf-hint"><kbd>X</kbd> swap colors</span>
            <span className="pf-hint"><kbd>[ ]</kbd> brush</span>
            <span className="pf-hint"><kbd>⌘K</kbd> command</span>
          </>
        )}
      </div>

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
