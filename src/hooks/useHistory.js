import { useCallback, useRef, useState } from "react";
import { HISTORY_LIMIT } from "../constants.js";
import { captureLayerSnapshot, restoreLayerSnapshot } from "../serialization.js";

export default function useHistory({
  docRef,
  docW,
  docH,
  activeId,
  selectedShape,
  setDocW,
  setDocH,
  setActiveId,
  setSelectedShape,
  setResizeForm,
  syncEditor,
  markDirty,
}) {
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [undoN, setUndoN] = useState(0);
  const [redoN, setRedoN] = useState(0);

  const syncUndo = useCallback(() => {
    setUndoN(undoStack.current.length);
    setRedoN(redoStack.current.length);
  }, []);

  const capturePatchSnapshot = useCallback((layerIds, includeMeta = false, meta = {}) => {
    const ids = Array.isArray(layerIds) ? layerIds.filter(Boolean) : [];
    return {
      mode: "patch",
      layers: ids.map(id => captureLayerSnapshot(docRef.current.layers[id])).filter(Boolean),
      activeId: includeMeta ? (meta.activeId ?? activeId) : undefined,
      selectedShape: includeMeta ? (meta.selectedShape ?? selectedShape) : undefined,
    };
  }, [activeId, docRef, selectedShape]);

  const captureFullSnapshot = useCallback((meta = {}) => {
    const d = docRef.current;
    return {
      mode: "replace",
      docW: meta.docW ?? docW,
      docH: meta.docH ?? docH,
      activeId: meta.activeId ?? activeId,
      selectedShape: meta.selectedShape ?? selectedShape,
      order: [...d.order],
      layers: d.order.map(id => captureLayerSnapshot(d.layers[id])).filter(Boolean),
    };
  }, [activeId, docH, docRef, docW, selectedShape]);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    if (snapshot.mode === "replace") {
      const nextDoc = { layers: {}, order: [...snapshot.order] };
      snapshot.layers.forEach(layerState => {
        nextDoc.layers[layerState.id] = restoreLayerSnapshot(layerState, snapshot.docW, snapshot.docH);
      });
      docRef.current = nextDoc;
      setDocW(snapshot.docW);
      setDocH(snapshot.docH);
      setActiveId(snapshot.activeId && nextDoc.layers[snapshot.activeId] ? snapshot.activeId : nextDoc.order[0] || null);
      setSelectedShape(snapshot.selectedShape || null);
      setResizeForm(prev => ({ ...prev, width: snapshot.docW, height: snapshot.docH }));
      syncEditor();
      return;
    }

    snapshot.layers.forEach(layerState => {
      if (layerState.region && layerState.type === "raster") {
        const existing = docRef.current.layers[layerState.id];
        if (existing?.type === "raster") {
          existing.canvas.getContext("2d").putImageData(
            layerState.imageData, layerState.region.x, layerState.region.y
          );
          existing.name = layerState.name;
          existing.visible = layerState.visible;
          existing.opacity = layerState.opacity;
          existing.blend = layerState.blend;
          existing.locked = layerState.locked;
          existing.contentHint = layerState.contentHint || "edited";
          existing.ox = layerState.ox;
          existing.oy = layerState.oy;
        } else {
          docRef.current.layers[layerState.id] = restoreLayerSnapshot(layerState, docW, docH);
        }
      } else {
        docRef.current.layers[layerState.id] = restoreLayerSnapshot(layerState, docW, docH);
      }
    });
    if (snapshot.activeId !== undefined) setActiveId(snapshot.activeId);
    if (snapshot.selectedShape !== undefined) setSelectedShape(snapshot.selectedShape);
    syncEditor();
  }, [docH, docRef, docW, setActiveId, setDocH, setDocW, setResizeForm, setSelectedShape, syncEditor]);

  const pushHistory = useCallback((before, after) => {
    undoStack.current.push({ before, after });
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    redoStack.current = [];
    syncUndo();
    markDirty();
  }, [markDirty, syncUndo]);

  const withFullHistory = useCallback((mutate) => {
    const before = captureFullSnapshot();
    const meta = mutate() || {};
    const after = captureFullSnapshot(meta);
    pushHistory(before, after);
    syncEditor();
  }, [captureFullSnapshot, pushHistory, syncEditor]);

  const commitPatchHistory = useCallback((before, layerIds, meta = {}) => {
    const after = capturePatchSnapshot(layerIds, true, meta);
    pushHistory(before, after);
    syncEditor();
  }, [capturePatchSnapshot, pushHistory, syncEditor]);

  const doUndo = useCallback(() => {
    if (!undoStack.current.length) return false;
    const entry = undoStack.current.pop();
    redoStack.current.push(entry);
    applySnapshot(entry.before);
    syncUndo();
    markDirty();
    return true;
  }, [applySnapshot, markDirty, syncUndo]);

  const doRedo = useCallback(() => {
    if (!redoStack.current.length) return false;
    const entry = redoStack.current.pop();
    undoStack.current.push(entry);
    applySnapshot(entry.after);
    syncUndo();
    markDirty();
    return true;
  }, [applySnapshot, markDirty, syncUndo]);

  const clearHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    syncUndo();
  }, [syncUndo]);

  return {
    undoN,
    redoN,
    capturePatchSnapshot,
    captureFullSnapshot,
    applySnapshot,
    pushHistory,
    withFullHistory,
    commitPatchHistory,
    doUndo,
    doRedo,
    clearHistory,
  };
}
