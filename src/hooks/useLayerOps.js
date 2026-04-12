import { useCallback } from "react";
import { uid, cloneShape, makeCanvas, reorderList } from "../utils.js";

function duplicateShapeOffset(shape) {
  if (shape.type === "line") {
    return { ...cloneShape(shape), id: uid(), x1: shape.x1 + 12, y1: shape.y1 + 12, x2: shape.x2 + 12, y2: shape.y2 + 12 };
  }
  return { ...cloneShape(shape), id: uid(), x: shape.x + 12, y: shape.y + 12 };
}

export default function useLayerOps({
  docRef,
  docW,
  docH,
  activeId,
  selectedShape,
  setActiveId,
  setSelectedShape,
  getLayer,
  withFullHistory,
  capturePatchSnapshot,
  commitPatchHistory,
  triggerFeedback,
  flash,
}) {
  const updateLayerState = useCallback((id, mutate) => {
    const layer = getLayer(id);
    if (!layer) return;
    const before = capturePatchSnapshot([id], true);
    mutate(layer);
    commitPatchHistory(before, [id], { selectedShape });
  }, [capturePatchSnapshot, commitPatchHistory, getLayer, selectedShape]);

  const addLayer = useCallback((type) => {
    withFullHistory(() => {
      const d = docRef.current;
      const layer = type === "raster"
        ? { id: uid(), name: "Layer " + (d.order.length + 1), type: "raster", visible: true, opacity: 1, blend: "source-over", locked: false, contentHint: "empty", canvas: makeCanvas(docW, docH), ox: 0, oy: 0 }
        : { id: uid(), name: "Vector " + (d.order.length + 1), type: "vector", visible: true, opacity: 1, blend: "source-over", locked: false, shapes: [], ox: 0, oy: 0 };
      d.layers[layer.id] = layer;
      d.order.push(layer.id);
      setActiveId(layer.id);
      setSelectedShape(null);
      return { activeId: layer.id, selectedShape: null };
    });
    triggerFeedback(type === "raster" ? "layer-add-raster" : "layer-add-vector", "success");
  }, [docH, docRef, docW, setActiveId, setSelectedShape, triggerFeedback, withFullHistory]);

  const delLayer = useCallback((id) => {
    const d = docRef.current;
    if (d.order.length <= 1) { triggerFeedback("layer-delete", "error"); flash("Need at least one layer", "error"); return; }
    withFullHistory(() => {
      d.order = d.order.filter(x => x !== id);
      delete d.layers[id];
      const nextActiveId = activeId === id ? d.order[d.order.length - 1] : activeId;
      setActiveId(nextActiveId);
      if (selectedShape?.layerId === id) setSelectedShape(null);
      return { activeId: nextActiveId, selectedShape: selectedShape?.layerId === id ? null : selectedShape };
    });
    triggerFeedback("layer-delete", "success");
  }, [activeId, docRef, flash, selectedShape, setActiveId, setSelectedShape, triggerFeedback, withFullHistory]);

  const moveLayer = useCallback((id, dir) => {
    const i = docRef.current.order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= docRef.current.order.length) return;
    withFullHistory(() => {
      const d = docRef.current;
      [d.order[i], d.order[j]] = [d.order[j], d.order[i]];
      return {};
    });
    triggerFeedback(dir > 0 ? "layer-up" : "layer-down", "success", 140);
  }, [docRef, triggerFeedback, withFullHistory]);

  const reorderLayer = useCallback((sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    withFullHistory(() => {
      const d = docRef.current;
      d.order = reorderList(d.order, sourceId, targetId);
      return {};
    });
  }, [docRef, withFullHistory]);

  const toggleVis = useCallback((id) => {
    updateLayerState(id, layer => { layer.visible = !layer.visible; });
    triggerFeedback(`layer-visibility-${id}`, "success", 140);
  }, [triggerFeedback, updateLayerState]);

  const setBlend = useCallback((id, m) => {
    updateLayerState(id, layer => { layer.blend = m; });
  }, [updateLayerState]);

  const renameLayer = useCallback((id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateLayerState(id, layer => { layer.name = trimmed; });
    triggerFeedback("layer-rename", "success", 140);
  }, [triggerFeedback, updateLayerState]);

  const toggleLock = useCallback((id) => {
    updateLayerState(id, layer => { layer.locked = !layer.locked; });
    triggerFeedback("layer-lock", "success", 140);
  }, [triggerFeedback, updateLayerState]);

  const duplicateActiveLayer = useCallback(() => {
    const layer = getLayer(activeId);
    if (!layer) return;
    withFullHistory(() => {
      const copyId = uid();
      const duplicate = layer.type === "raster"
        ? {
          id: copyId,
          name: `${layer.name} Copy`,
          type: "raster",
          visible: layer.visible,
          opacity: layer.opacity,
          blend: layer.blend,
          locked: false,
          contentHint: layer.contentHint || "edited",
          canvas: makeCanvas(docW, docH),
          ox: layer.ox + 12,
          oy: layer.oy + 12,
        }
        : {
          id: copyId,
          name: `${layer.name} Copy`,
          type: "vector",
          visible: layer.visible,
          opacity: layer.opacity,
          blend: layer.blend,
          locked: false,
          shapes: layer.shapes.map(duplicateShapeOffset),
          ox: layer.ox + 12,
          oy: layer.oy + 12,
        };
      if (duplicate.type === "raster") duplicate.canvas.getContext("2d").drawImage(layer.canvas, 0, 0);
      const index = docRef.current.order.indexOf(layer.id);
      docRef.current.layers[duplicate.id] = duplicate;
      docRef.current.order.splice(index + 1, 0, duplicate.id);
      setActiveId(duplicate.id);
      setSelectedShape(null);
      return { activeId: duplicate.id, selectedShape: null };
    });
    triggerFeedback("layer-duplicate", "success");
  }, [activeId, docH, docRef, docW, getLayer, setActiveId, setSelectedShape, triggerFeedback, withFullHistory]);

  const mergeLayerDown = useCallback((id) => {
    const index = docRef.current.order.indexOf(id);
    const upper = getLayer(id);
    const lower = getLayer(docRef.current.order[index - 1]);
    if (!upper || !lower || upper.type !== "raster" || lower.type !== "raster") {
      triggerFeedback("layer-merge", "error");
      flash("Merge Down needs two adjacent raster layers.", "error");
      return;
    }
    withFullHistory(() => {
      const ctx = lower.canvas.getContext("2d");
      ctx.save();
      ctx.globalAlpha = upper.opacity;
      ctx.globalCompositeOperation = upper.blend;
      ctx.translate(upper.ox - lower.ox, upper.oy - lower.oy);
      ctx.drawImage(upper.canvas, 0, 0);
      ctx.restore();
      lower.contentHint = upper.contentHint === "image" || lower.contentHint === "image" ? "image" : "edited";
      docRef.current.order = docRef.current.order.filter(layerId => layerId !== upper.id);
      delete docRef.current.layers[upper.id];
      setActiveId(lower.id);
      if (selectedShape?.layerId === upper.id) setSelectedShape(null);
      return { activeId: lower.id, selectedShape: selectedShape?.layerId === upper.id ? null : selectedShape };
    });
    triggerFeedback("layer-merge", "success");
  }, [docRef, flash, getLayer, selectedShape, setActiveId, setSelectedShape, triggerFeedback, withFullHistory]);

  return {
    addLayer,
    delLayer,
    moveLayer,
    reorderLayer,
    toggleVis,
    setBlend,
    renameLayer,
    toggleLock,
    duplicateActiveLayer,
    mergeLayerDown,
  };
}
