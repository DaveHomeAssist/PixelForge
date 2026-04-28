import { useCallback } from "react";
import { uid, cloneShape, makeCanvas, reorderList } from "../utils.js";
import { DEFAULT_TEXT_LAYER } from "../text.js";

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
      const base = { id: uid(), visible: true, opacity: 1, blend: "source-over", locked: false, ox: 0, oy: 0 };
      let layer;
      if (type === "raster") {
        layer = { ...base, name: "Layer " + (d.order.length + 1), type: "raster", contentHint: "empty", canvas: makeCanvas(docW, docH) };
      } else if (type === "text") {
        layer = { ...base, name: "Text " + (d.order.length + 1), type: "text", ...DEFAULT_TEXT_LAYER };
      } else {
        layer = { ...base, name: "Vector " + (d.order.length + 1), type: "vector", shapes: [] };
      }
      d.layers[layer.id] = layer;
      d.order.push(layer.id);
      setActiveId(layer.id);
      setSelectedShape(null);
      return { activeId: layer.id, selectedShape: null };
    });
    const feedbackKey = type === "raster" ? "layer-add-raster"
      : type === "text" ? "layer-add-text"
      : "layer-add-vector";
    triggerFeedback(feedbackKey, "success");
  }, [docH, docRef, docW, setActiveId, setSelectedShape, triggerFeedback, withFullHistory]);

  const addTextLayerAt = useCallback((at) => {
    let newId = null;
    withFullHistory(() => {
      const d = docRef.current;
      const layer = {
        id: uid(),
        name: "Text " + (d.order.length + 1),
        type: "text",
        visible: true,
        opacity: 1,
        blend: "source-over",
        locked: false,
        ox: Math.round(at?.x || 0),
        oy: Math.round(at?.y || 0),
        ...DEFAULT_TEXT_LAYER,
      };
      d.layers[layer.id] = layer;
      d.order.push(layer.id);
      setActiveId(layer.id);
      setSelectedShape(null);
      newId = layer.id;
      return { activeId: layer.id, selectedShape: null };
    });
    return newId;
  }, [docRef, setActiveId, setSelectedShape, withFullHistory]);

  const updateTextLayer = useCallback((id, partial) => {
    const layer = getLayer(id);
    if (!layer || layer.type !== "text") return;
    const before = capturePatchSnapshot([id], true);
    Object.assign(layer, partial);
    commitPatchHistory(before, [id], { selectedShape });
  }, [capturePatchSnapshot, commitPatchHistory, getLayer, selectedShape]);

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
    const j = dir === "top" ? docRef.current.order.length - 1
      : dir === "bottom" ? 0
      : i + dir;
    if (j < 0 || j >= docRef.current.order.length) return;
    withFullHistory(() => {
      const d = docRef.current;
      const [layerId] = d.order.splice(i, 1);
      d.order.splice(j, 0, layerId);
      return {};
    });
    triggerFeedback(dir === "top" || dir > 0 ? "layer-up" : "layer-down", "success", 140);
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

  const duplicateLayer = useCallback((layerId = activeId) => {
    const layer = getLayer(layerId);
    if (!layer) return;
    withFullHistory(() => {
      const copyId = uid();
      const baseCopy = {
        id: copyId,
        name: `${layer.name} Copy`,
        visible: layer.visible,
        opacity: layer.opacity,
        blend: layer.blend,
        locked: false,
        ox: layer.ox + 12,
        oy: layer.oy + 12,
      };
      let duplicate;
      if (layer.type === "raster") {
        duplicate = {
          ...baseCopy,
          type: "raster",
          contentHint: layer.contentHint || "edited",
          canvas: makeCanvas(docW, docH),
        };
      } else if (layer.type === "text") {
        duplicate = {
          ...baseCopy,
          type: "text",
          text: layer.text,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize,
          fontWeight: layer.fontWeight,
          italic: layer.italic,
          color: layer.color,
          align: layer.align,
          maxWidth: layer.maxWidth,
        };
      } else {
        duplicate = {
          ...baseCopy,
          type: "vector",
          shapes: layer.shapes.map(duplicateShapeOffset),
        };
      }
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

  const duplicateActiveLayer = useCallback(() => duplicateLayer(activeId), [activeId, duplicateLayer]);

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
    addTextLayerAt,
    updateTextLayer,
    delLayer,
    moveLayer,
    reorderLayer,
    toggleVis,
    setBlend,
    renameLayer,
    toggleLock,
    duplicateLayer,
    duplicateActiveLayer,
    mergeLayerDown,
  };
}
