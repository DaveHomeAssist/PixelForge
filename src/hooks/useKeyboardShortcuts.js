import { useCallback, useEffect } from "react";
import { isEditableTarget, cloneShape as cloneShapeUtil } from "../utils.js";

/**
 * useKeyboardShortcuts
 *
 * Owns the global keydown/keyup listeners and the related shape duplication /
 * deletion / undo+redo / zoom helpers.
 *
 * Modal gate: when `modalOpen` is truthy, bare-letter shortcuts (V, B, M, R,
 * X, etc.) are suppressed so a key pressed inside a modal does not flip the
 * canvas tool behind it. Modifier-driven shortcuts (Cmd/Ctrl/Alt) and Escape
 * still flow so undo, redo, save, the command palette, and modal-close keep
 * working. The gate sits at the very top of the keydown handler.
 */
export default function useKeyboardShortcuts({
  // State reads
  selectedShape,
  space,
  selectionMask,
  activeId,
  tool,
  isCompactUI,
  modalOpen,
  // Setters
  setBrushSize,
  setPan,
  setIsSpaceHeld,
  setSelectedShape,
  setCommandOpen,
  setMobilePanelTab,
  // Callbacks from other hooks / modules
  doUndo,
  doRedo,
  handleSave,
  handleFitView,
  zoomAtViewportPoint,
  clearSelection,
  duplicateActiveLayer,
  selectTool,
  swapColors,
  copyMarquee,
  cutMarquee,
  deleteMarquee,
  nudgeMarquee,
  escapeMarquee,
  deselectRasterSelection,
  selectAllActive,
  moveLayer,
  nudgeSelectedShape,
  // Shape op deps
  findShapeRecord,
  canEditLayer,
  capturePatchSnapshot,
  commitPatchHistory,
  cloneShape = cloneShapeUtil,
  uid,
  triggerFeedback,
}) {
  // Future-spec wiring kept on the signature; suppress lint here so renaming
  // these later does not require an interface change.
  void tool; void isCompactUI; void setMobilePanelTab;

  /* ─── Undo / Redo ─── */
  const handleUndo = useCallback(() => {
    if (doUndo()) triggerFeedback("undo", "success", 140);
  }, [doUndo, triggerFeedback]);

  const handleRedo = useCallback(() => {
    if (doRedo()) triggerFeedback("redo", "success", 140);
  }, [doRedo, triggerFeedback]);

  const zoomIn = useCallback(() => {
    zoomAtViewportPoint(1.2);
    triggerFeedback("zoom-in", "success", 140);
  }, [triggerFeedback, zoomAtViewportPoint]);

  const zoomOut = useCallback(() => {
    zoomAtViewportPoint(1 / 1.2);
    triggerFeedback("zoom-out", "success", 140);
  }, [triggerFeedback, zoomAtViewportPoint]);

  /* ─── Shape duplication / deletion (internal) ─── */
  function duplicateShape(shape) {
    if (shape.type === "line" || shape.type === "path") {
      return {
        ...cloneShape(shape),
        id: uid(),
        x1: shape.x1 + 12,
        y1: shape.y1 + 12,
        x2: shape.x2 + 12,
        y2: shape.y2 + 12,
      };
    }
    return {
      ...cloneShape(shape),
      id: uid(),
      x: shape.x + 12,
      y: shape.y + 12,
    };
  }

  const duplicateSelectedShape = useCallback(() => {
    const record = findShapeRecord();
    if (!record || !canEditLayer(record.layer, "duplicate this shape")) return;
    const before = capturePatchSnapshot([record.layer.id], true);
    const nextShape = duplicateShape(record.shape);
    record.layer.shapes.push(nextShape);
    const nextSelection = { layerId: record.layer.id, shapeId: nextShape.id };
    setSelectedShape(nextSelection);
    commitPatchHistory(before, [record.layer.id], { selectedShape: nextSelection });
    triggerFeedback("shape-duplicate", "success");
    // duplicateShape closes over uid + cloneShape, both stable — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditLayer, capturePatchSnapshot, commitPatchHistory, findShapeRecord, setSelectedShape, triggerFeedback]);

  const deleteSelectedShape = useCallback(() => {
    const record = findShapeRecord();
    if (!record || !canEditLayer(record.layer, "delete this shape")) return;
    const before = capturePatchSnapshot([record.layer.id], true);
    record.layer.shapes.splice(record.index, 1);
    setSelectedShape(null);
    commitPatchHistory(before, [record.layer.id], { selectedShape: null });
    triggerFeedback("shape-delete", "success");
  }, [canEditLayer, capturePatchSnapshot, commitPatchHistory, findShapeRecord, setSelectedShape, triggerFeedback]);

  /* ─── Keyboard ─── */
  useEffect(() => {
    const kd = (e) => {
      const typing = isEditableTarget(e.target);
      const key = e.key.toLowerCase();
      // Modal gate: when any modal is open, suppress bare-letter tool
      // shortcuts. Modifier-driven shortcuts (Cmd/Ctrl/Alt) and Escape
      // continue to flow so undo, redo, save, command palette, and modal
      // close still work.
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      if (modalOpen && !hasModifier && e.key !== "Escape") {
        return;
      }
      if (e.code === "Space" && !typing) { space.current = true; setIsSpaceHeld(true); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && (key === "=" || key === "+")) { e.preventDefault(); zoomIn(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "-") { e.preventDefault(); zoomOut(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "0") { e.preventDefault(); handleFitView(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "z") { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "y") { e.preventDefault(); handleRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); handleSave(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "k") { e.preventDefault(); setCommandOpen(true); return; }
      if ((e.ctrlKey || e.metaKey) && key === "d" && !typing) {
        e.preventDefault();
        if (selectedShape) duplicateSelectedShape();
        else duplicateActiveLayer();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === "j" && !typing) {
        e.preventDefault();
        if (selectedShape) duplicateSelectedShape();
        else duplicateActiveLayer();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === "a" && !typing) {
        e.preventDefault();
        if (e.shiftKey) {
          deselectRasterSelection();
        } else {
          selectAllActive();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "]") { e.preventDefault(); if (activeId) moveLayer(activeId, "top"); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "[") { e.preventDefault(); if (activeId) moveLayer(activeId, "bottom"); return; }
      // Marquee clipboard ops (before paste — paste is handled by the document-level listener)
      if (!typing && selectionMask) {
        if ((e.ctrlKey || e.metaKey) && key === "c") {
          e.preventDefault();
          copyMarquee();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && key === "x") {
          e.preventDefault();
          cutMarquee();
          return;
        }
      }
      if (typing) return;
      const sc = { v:"move", h:"hand", m:"marquee", a:"lasso", w:"magic", b:"brush", e:"eraser", g:"bucket", n:"gradient", r:"rect", o:"ellipse", p:"polygon", s:"star", l:"line", k:"pen", t:"text", i:"eyedropper" };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && sc[key]) selectTool(sc[key]);
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === "x" && !selectionMask) swapColors();
      if (e.key === "Escape") {
        if (!escapeMarquee()) clearSelection();
      }
      if ((e.key === "Delete" || e.key === "Backspace")) {
        if (selectionMask) {
          e.preventDefault();
          deleteMarquee();
        } else if (selectedShape) {
          e.preventDefault();
          deleteSelectedShape();
        }
      }
      if (selectionMask && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudgeMarquee(dx, dy);
      }
      if (!selectionMask && selectedShape && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudgeSelectedShape(dx, dy);
      }
      if (!selectionMask && !selectedShape && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 64 : 16;
        const dx = e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0;
        const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
      if (e.key === "[") setBrushSize(s => Math.max(1, s - 2));
      if (e.key === "]") setBrushSize(s => Math.min(200, s + 2));
    };
    const ku = (e) => { if (e.code === "Space") { space.current = false; setIsSpaceHeld(false); } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [
    activeId, clearSelection, copyMarquee, cutMarquee, deleteMarquee, deleteSelectedShape,
    deselectRasterSelection, duplicateActiveLayer, duplicateSelectedShape, escapeMarquee,
    handleFitView, handleRedo, handleSave, handleUndo, modalOpen, moveLayer, nudgeMarquee,
    nudgeSelectedShape, selectAllActive, selectTool, selectedShape, selectionMask,
    setBrushSize, setCommandOpen, setIsSpaceHeld, setPan, space, swapColors, zoomIn, zoomOut,
  ]);

  return {
    handleUndo,
    handleRedo,
    zoomIn,
    zoomOut,
    // Returned for use by ContextMenu / CommandPalette / mobile selection panel.
    // Spec calls these "internal" but the existing PixelForge wires them to
    // multiple non-keyboard call sites; returning them preserves behavior
    // without churning unrelated components in this PR.
    duplicateSelectedShape,
    deleteSelectedShape,
  };
}
