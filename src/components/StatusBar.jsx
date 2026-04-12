export default function StatusBar({
  docW,
  docH,
  zoom,
  activeLayer,
  toolMeta,
  isDirty,
  lastSavedAt,
}) {
  return (
    <div className="pf-status">
      <span>{docW} × {docH}</span>
      <span className="pf-status-accent">{(zoom * 100).toFixed(0)}%</span>
      {activeLayer && <span>{activeLayer.name} <span style={{ color: "#c8b9a8" }}>|</span> {activeLayer.type === "raster" ? "RASTER" : "VECTOR"}</span>}
      <span>{toolMeta.label}</span>
      <span>{isDirty ? "Unsaved draft" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Ready"}</span>
      <span style={{ marginLeft: "auto" }}>Space drag pans · Scroll zooms · X swaps colors · [ ] resizes brush</span>
    </div>
  );
}
