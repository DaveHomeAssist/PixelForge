import { useState } from "react";
import {
  Undo2, Redo2, Save, FolderOpen, Download, Menu, X,
} from "lucide-react";

/**
 * EditorMenu (mobile sheet only)
 *
 * As of PR 3 of the redesign cycle (2026-05-04) the desktop top region of
 * EditorMenu has been replaced by <TopBar />. This component now only renders
 * the mobile-menu trigger and its slide-out sheet (the @media (max-width: 920px)
 * portion explicitly preserved per plan section 9, decision 5). All callbacks
 * remain so the existing sheet keeps working untouched on small viewports.
 */
export default function EditorMenu({
  handleNewDocument,
  handleImportImage,
  handlePaste,
  onResizeDocument,
  handleLoad,
  handleSave,
  handleOpenExport,
  handleQuickExport,
  handleOpenAIGenerate,
  prefs,
  imageActions,
  editActions,
  adjustmentActions,
  workspaceActions,
  openCommandPalette,
  openHistoryPanel,
  doUndo,
  doRedo,
  hasArtwork,
  undoN,
  redoN,
  saveButtonLabel,
  canUseFileSave,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const adjustmentsEnabled = !!prefs?.uiPrefs?.tier2Flags?.adjustments;

  const runMobileAction = (action) => {
    setMobileOpen(false);
    action?.();
  };

  return (
    <div className="pf-mobile-menu-wrap">
      <button
        className="pf-mobile-menu-btn"
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={16} />
      </button>
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
              {editActions?.canDeselect && <button className="pf-mbtn" onClick={() => runMobileAction(editActions.deselect)}>Deselect</button>}
              <button className="pf-mbtn" onClick={() => runMobileAction(handleQuickExport)}>Export Last</button>
              {imageActions && <button className="pf-mbtn" onClick={() => runMobileAction(imageActions.trim)}>Trim</button>}
              {editActions && <button className="pf-mbtn" onClick={() => runMobileAction(() => editActions.adjust("grayscale"))}>Grayscale</button>}
              {adjustmentsEnabled && (
                <>
                  <button className="pf-mbtn" onClick={() => runMobileAction(() => adjustmentActions?.open("brightness"))}>Brightness</button>
                  <button className="pf-mbtn" onClick={() => runMobileAction(() => adjustmentActions?.commit("invert"))}>Invert</button>
                </>
              )}
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
