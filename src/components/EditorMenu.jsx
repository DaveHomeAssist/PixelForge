import { useState } from "react";
import {
  Undo2, Redo2, Save, FolderOpen, Download, ZoomIn, ZoomOut, Maximize2, Menu, X,
} from "lucide-react";

export default function EditorMenu({
  feedbackClass,
  handleNewDocument,
  handleImportImage,
  onResizeDocument,
  handleLoad,
  handleSave,
  handleExport,
  handleOpenAIGenerate,
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const runMobileAction = (action) => {
    setMobileOpen(false);
    action?.();
  };

  return (
    <div className="pf-menu">
      <button className="pf-mobile-menu-btn" type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={16} />
      </button>
      <div className="pf-menu-group">
        <span className="pf-menu-brand">PixelForge</span>
        <div className="pf-menu-sep" />
        <button className={`pf-mbtn pf-mobile-sheet-only ${feedbackClass("new-doc")}`} onClick={handleNewDocument} title="Create a new document">New</button>
        <button className={`pf-mbtn pf-mobile-sheet-only ${!hasArtwork ? "primary" : ""} ${feedbackClass("import")}`} onClick={handleImportImage} title="Import an image into a new raster layer">Import</button>
        <button className={`pf-mbtn pf-mobile-sheet-only ${feedbackClass("resize-doc")}`} onClick={onResizeDocument} title="Resize the current document">Resize</button>
        <button className={`pf-mbtn pf-mobile-sheet-only ${feedbackClass("load")}`} onClick={handleLoad} title="Open a saved PixelForge project"><FolderOpen size={12} /> Open</button>
        <button className={`pf-mbtn ${feedbackClass("save")}`} onClick={handleSave} title={saveButtonTitle}>{canUseFileSave ? <Save size={12} /> : <Download size={12} />} {saveButtonLabel}</button>
        <button className={`pf-mbtn ${hasArtwork ? "primary" : ""} ${feedbackClass("export")}`} onClick={handleExport} title="Export a flattened PNG"><Download size={12} /> Export PNG</button>
        {handleOpenAIGenerate && (
          <button className={`pf-mbtn pf-mobile-sheet-only ${feedbackClass("ai-generate")}`} onClick={handleOpenAIGenerate} title="Generate image with AI" aria-label="Generate with AI">Generate</button>
        )}
        <div className="pf-menu-sep" />
        <button className={`pf-mbtn pf-mobile-sheet-only ${undoN === 0 ? "dis" : ""} ${feedbackClass("undo")}`} onClick={doUndo} title="Undo (Cmd/Ctrl+Z)"><Undo2 size={12} /> Undo</button>
        <button className={`pf-mbtn pf-mobile-sheet-only ${redoN === 0 ? "dis" : ""} ${feedbackClass("redo")}`} onClick={doRedo} title="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)"><Redo2 size={12} /> Redo</button>
      </div>

      <div className="pf-menu-meta">
        <span className="pf-menu-chip accent">{toolMeta.label}</span>
        {activeLayer && <span className="pf-menu-chip">{activeLayer.name}</span>}
        <button className="pf-menu-chip pf-menu-chip-button" type="button" onClick={onResizeDocument} title="Resize the current document">{docW} × {docH}</button>
        <span className="pf-menu-chip">{isDirty ? "Unsaved" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Clean"}</span>
      </div>

      <div className="pf-menu-r">
        <button className={`pf-mbtn ${feedbackClass("zoom-in")}`} onClick={zoomIn} title="Zoom in"><ZoomIn size={12} /></button>
        <span className="pf-zoom">{(zoom * 100).toFixed(0)}%</span>
        <button className={`pf-mbtn ${feedbackClass("zoom-out")}`} onClick={zoomOut} title="Zoom out"><ZoomOut size={12} /></button>
        <button className={`pf-mbtn ${feedbackClass("zoom-fit")}`} onClick={handleFitView} title="Fit document to view"><Maximize2 size={11} /> Fit</button>
      </div>
      {mobileOpen && (
        <div className="pf-mobile-menu-backdrop" role="dialog" aria-modal="true" aria-label="Editor menu">
          <div className="pf-mobile-menu-sheet">
            <div className="pf-mobile-menu-head">
              <span className="pf-menu-brand">PixelForge</span>
              <button className="pf-icon-btn" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={16} /></button>
            </div>
            <div className="pf-mobile-menu-grid">
              <button className="pf-mbtn" onClick={() => runMobileAction(handleNewDocument)}>New</button>
              <button className={`pf-mbtn ${!hasArtwork ? "primary" : ""}`} onClick={() => runMobileAction(handleImportImage)}>Import</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(onResizeDocument)}>Resize</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(handleLoad)}><FolderOpen size={12} /> Open</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(handleSave)}>{canUseFileSave ? <Save size={12} /> : <Download size={12} />} {saveButtonLabel}</button>
              <button className={`pf-mbtn ${hasArtwork ? "primary" : ""}`} onClick={() => runMobileAction(handleExport)}><Download size={12} /> Export</button>
              {handleOpenAIGenerate && <button className="pf-mbtn" onClick={() => runMobileAction(handleOpenAIGenerate)}>Generate</button>}
              <button className={`pf-mbtn ${undoN === 0 ? "dis" : ""}`} onClick={() => runMobileAction(doUndo)}><Undo2 size={12} /> Undo</button>
              <button className={`pf-mbtn ${redoN === 0 ? "dis" : ""}`} onClick={() => runMobileAction(doRedo)}><Redo2 size={12} /> Redo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
