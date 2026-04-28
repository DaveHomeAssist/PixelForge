import { useEffect, useRef, useState } from "react";
import {
  Undo2, Redo2, Save, FolderOpen, Download, ZoomIn, ZoomOut, Maximize2, Menu, X, ChevronDown,
} from "lucide-react";

export default function EditorMenu({
  feedbackClass,
  handleNewDocument,
  handleImportImage,
  handlePaste,
  onResizeDocument,
  handleLoad,
  handleSave,
  handleOpenExport,
  handleQuickExport,
  handleOpenAIGenerate,
  imageActions,
  editActions,
  workspaceActions,
  openCommandPalette,
  openHistoryPanel,
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
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const runMobileAction = (action) => {
    setMobileOpen(false);
    action?.();
  };
  const runMenuAction = (action) => {
    setOpenMenu(null);
    action?.();
  };
  const toggleMenu = (id) => setOpenMenu(current => current === id ? null : id);

  const menuButton = (menuId, label) => (
    <button
      className={`pf-menu-trigger ${openMenu === menuId ? "active" : ""}`}
      type="button"
      onClick={() => toggleMenu(menuId)}
      aria-haspopup="menu"
      aria-expanded={openMenu === menuId}
    >
      {label}
      <ChevronDown size={12} />
    </button>
  );

  const menuItem = (label, action, options = {}) => (
    <button
      className={`pf-menu-item ${options.danger ? "danger" : ""}`}
      type="button"
      role="menuitem"
      onClick={() => runMenuAction(action)}
      disabled={options.disabled}
    >
      <span>{label}</span>
      {options.shortcut && <kbd>{options.shortcut}</kbd>}
    </button>
  );

  return (
    <div className="pf-menu" ref={menuRef}>
      <button className="pf-mobile-menu-btn" type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={16} />
      </button>
      <div className="pf-menu-group">
        <span className="pf-menu-brand">PixelForge</span>
        <div className="pf-menu-sep" />
        <div className="pf-menu-dropdown">
          {menuButton("file", "File")}
          {openMenu === "file" && (
            <div className="pf-menu-popover" role="menu" aria-label="File menu">
              {menuItem("New Document", handleNewDocument)}
              {menuItem("Import Image", handleImportImage)}
              {menuItem("Paste Image", handlePaste, { shortcut: "Cmd V" })}
              {menuItem("Open Project", handleLoad)}
              <div className="pf-menu-rule" />
              {menuItem(saveButtonLabel, handleSave)}
              {menuItem("Export", handleOpenExport)}
              {menuItem("Export Last", handleQuickExport)}
              {handleOpenAIGenerate && menuItem("Generate Image", handleOpenAIGenerate)}
            </div>
          )}
        </div>
        <div className="pf-menu-dropdown">
          {menuButton("edit", "Edit")}
          {openMenu === "edit" && (
            <div className="pf-menu-popover" role="menu" aria-label="Edit menu">
              {menuItem("Undo", doUndo, { shortcut: "Cmd Z", disabled: undoN === 0 })}
              {menuItem("Redo", doRedo, { shortcut: "Shift Cmd Z", disabled: redoN === 0 })}
              <div className="pf-menu-rule" />
              {menuItem("Grayscale", () => editActions?.adjust("grayscale"))}
              {menuItem("Sharpen", () => editActions?.filter("sharpen"))}
              {menuItem("Blur", () => editActions?.filter("blur"))}
            </div>
          )}
        </div>
        <div className="pf-menu-dropdown">
          {menuButton("image", "Image")}
          {openMenu === "image" && (
            <div className="pf-menu-popover" role="menu" aria-label="Image menu">
              {menuItem("Resize Canvas", onResizeDocument)}
              {menuItem("Crop Selection", imageActions?.crop, { disabled: !imageActions?.canCrop })}
              {menuItem("Trim Canvas", imageActions?.trim)}
              <div className="pf-menu-rule" />
              {menuItem("Rotate 90", () => imageActions?.rotate(90))}
              {menuItem("Flip Horizontal", () => imageActions?.flip("h"))}
            </div>
          )}
        </div>
        <div className="pf-menu-dropdown">
          {menuButton("view", "View")}
          {openMenu === "view" && (
            <div className="pf-menu-popover" role="menu" aria-label="View menu">
              {menuItem("Zoom In", zoomIn, { shortcut: "Cmd +" })}
              {menuItem("Zoom Out", zoomOut, { shortcut: "Cmd -" })}
              {menuItem("Fit View", handleFitView, { shortcut: "Cmd 0" })}
              <div className="pf-menu-rule" />
              {menuItem("Toggle Grid", () => workspaceActions?.toggle("showGrid"))}
              {menuItem("Toggle Rulers", () => workspaceActions?.toggle("showRulers"))}
              {menuItem("Toggle Snap", () => workspaceActions?.toggle("snapToGrid"))}
              {menuItem("Command Palette", openCommandPalette, { shortcut: "Cmd K" })}
              {menuItem("History Panel", openHistoryPanel)}
            </div>
          )}
        </div>
        <button className={`pf-mbtn ${feedbackClass("save")}`} onClick={handleSave} title={saveButtonTitle}>{canUseFileSave ? <Save size={12} /> : <Download size={12} />} {saveButtonLabel}</button>
        <button className={`pf-mbtn ${hasArtwork ? "primary" : ""} ${feedbackClass("export")}`} onClick={handleOpenExport} title="Choose export options"><Download size={12} /> Export</button>
      </div>

      <div className="pf-menu-meta">
        <span className="pf-menu-chip accent">{toolMeta.label}</span>
        {activeLayer && <span className="pf-menu-chip">{activeLayer.name}</span>}
        <button className="pf-menu-chip pf-menu-chip-button" type="button" onClick={onResizeDocument} title="Resize the current document">{docW} × {docH}</button>
        <span className="pf-menu-chip">{isDirty ? "Unsaved" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Clean"}</span>
      </div>

      <div className="pf-menu-r">
        <button className={`pf-mbtn pf-compact-icon ${feedbackClass("undo")} ${undoN === 0 ? "dis" : ""}`} onClick={doUndo} title="Undo"><Undo2 size={12} /></button>
        <button className={`pf-mbtn pf-compact-icon ${feedbackClass("redo")} ${redoN === 0 ? "dis" : ""}`} onClick={doRedo} title="Redo"><Redo2 size={12} /></button>
        <button className={`pf-mbtn ${feedbackClass("zoom-in")}`} onClick={zoomIn} title="Zoom in"><ZoomIn size={12} /></button>
        <span className="pf-zoom">{(zoom * 100).toFixed(0)}%</span>
        <button className={`pf-mbtn ${feedbackClass("zoom-out")}`} onClick={zoomOut} title="Zoom out"><ZoomOut size={12} /></button>
        <button className={`pf-mbtn ${feedbackClass("zoom-fit")}`} onClick={handleFitView} title="Fit document to view"><Maximize2 size={11} /> Fit</button>
        <button className="pf-mbtn" onClick={openCommandPalette} title="Command palette (Cmd/Ctrl+K)">Cmd</button>
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
              <button className="pf-mbtn" onClick={() => runMobileAction(handlePaste)}>Paste</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(onResizeDocument)}>Resize</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(handleLoad)}><FolderOpen size={12} /> Open</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(handleSave)}>{canUseFileSave ? <Save size={12} /> : <Download size={12} />} {saveButtonLabel}</button>
              <button className={`pf-mbtn ${hasArtwork ? "primary" : ""}`} onClick={() => runMobileAction(handleOpenExport)}><Download size={12} /> Export</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(handleQuickExport)}>Export Last</button>
              {imageActions && <button className="pf-mbtn" onClick={() => runMobileAction(imageActions.trim)}>Trim</button>}
              {editActions && <button className="pf-mbtn" onClick={() => runMobileAction(() => editActions.adjust("grayscale"))}>Grayscale</button>}
              {workspaceActions && <button className="pf-mbtn" onClick={() => runMobileAction(() => workspaceActions.toggle("showGrid"))}>Grid</button>}
              <button className="pf-mbtn" onClick={() => runMobileAction(openCommandPalette)}>Commands</button>
              <button className="pf-mbtn" onClick={() => runMobileAction(openHistoryPanel)}>History</button>
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
