import {
  Undo2, Redo2, Save, FolderOpen, Download, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";

export default function EditorMenu({
  feedbackClass,
  handleNewDocument,
  handleImportImage,
  onResizeDocument,
  handleLoad,
  handleSave,
  handleExport,
  doUndo,
  doRedo,
  toolMeta,
  activeLayer,
  docW,
  docH,
  isDirty,
  lastSavedAt,
  hasArtwork,
  undoN,
  redoN,
  zoom,
  zoomIn,
  zoomOut,
  handleFitView,
  saveButtonLabel,
  saveButtonTitle,
  canUseFileSave,
}) {
  return (
    <div className="pf-menu">
      <div className="pf-menu-group">
        <span className="pf-menu-brand">PixelForge</span>
        <div className="pf-menu-sep" />
        <button className={`pf-mbtn ${feedbackClass("new-doc")}`} onClick={handleNewDocument} title="Create a new document">New</button>
        <button className={`pf-mbtn ${!hasArtwork ? "primary" : ""} ${feedbackClass("import")}`} onClick={handleImportImage} title="Import an image into a new raster layer">Import</button>
        <button className={`pf-mbtn ${feedbackClass("resize-doc")}`} onClick={onResizeDocument} title="Resize the current document">Resize</button>
        <button className={`pf-mbtn ${feedbackClass("load")}`} onClick={handleLoad} title="Open a saved PixelForge project"><FolderOpen size={12} /> Open</button>
        <button className={`pf-mbtn ${feedbackClass("save")}`} onClick={handleSave} title={saveButtonTitle}>{canUseFileSave ? <Save size={12} /> : <Download size={12} />} {saveButtonLabel}</button>
        <button className={`pf-mbtn ${hasArtwork ? "primary" : ""} ${feedbackClass("export")}`} onClick={handleExport} title="Export a flattened PNG"><Download size={12} /> Export PNG</button>
        <div className="pf-menu-sep" />
        <button className={`pf-mbtn ${undoN === 0 ? "dis" : ""} ${feedbackClass("undo")}`} onClick={doUndo} title="Undo (Cmd/Ctrl+Z)"><Undo2 size={12} /> Undo</button>
        <button className={`pf-mbtn ${redoN === 0 ? "dis" : ""} ${feedbackClass("redo")}`} onClick={doRedo} title="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)"><Redo2 size={12} /> Redo</button>
      </div>

      <div className="pf-menu-meta">
        <span className="pf-menu-chip accent">{toolMeta.label}</span>
        {activeLayer && <span className="pf-menu-chip">{activeLayer.name}</span>}
        <span className="pf-menu-chip">{docW} × {docH}</span>
        <span className="pf-menu-chip">{isDirty ? "Unsaved" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Clean"}</span>
      </div>

      <div className="pf-menu-r">
        <button className={`pf-mbtn ${feedbackClass("zoom-in")}`} onClick={zoomIn} title="Zoom in"><ZoomIn size={12} /></button>
        <span className="pf-zoom">{(zoom * 100).toFixed(0)}%</span>
        <button className={`pf-mbtn ${feedbackClass("zoom-out")}`} onClick={zoomOut} title="Zoom out"><ZoomOut size={12} /></button>
        <button className={`pf-mbtn ${feedbackClass("zoom-fit")}`} onClick={handleFitView} title="Fit document to view"><Maximize2 size={11} /> Fit</button>
      </div>
    </div>
  );
}
