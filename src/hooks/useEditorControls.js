import { useCallback } from "react";
import { HEX_COLOR_RE } from "../constants.js";
import { clamp, normalizeHexColor } from "../utils.js";

export default function useEditorControls({
  activeId,
  color1,
  color2,
  selectedShape,
  controlTxRef,
  getLayer,
  capturePatchSnapshot,
  commitPatchHistory,
  findShapeRecord,
  shapeToDraft,
  syncEditor,
  setOpacityDraft,
  setSelectionDraft,
  setColor1,
  setColor1Input,
  setColor2,
  setColor2Input,
  triggerFeedback,
  triggerFieldFeedback,
  flash,
}) {
  const commitColor = useCallback((which, value) => {
    const raw = (value || "").trim();
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    const field = which === 1 ? "color1" : "color2";
    const scope = which === 1 ? "color-primary" : "color-secondary";
    if (!HEX_COLOR_RE.test(hex)) {
      const fallback = which === 1 ? color1 : color2;
      if (which === 1) setColor1Input(fallback);
      else setColor2Input(fallback);
      triggerFieldFeedback(field, "error");
      triggerFeedback(scope, "error");
      flash("Use a valid 3 or 6 digit hex color.", "error");
      return;
    }
    const next = normalizeHexColor(hex, which === 1 ? color1 : color2);
    if (which === 1) {
      setColor1(next);
      setColor1Input(next);
    } else {
      setColor2(next);
      setColor2Input(next);
    }
    triggerFeedback(scope, "success", 140);
  }, [
    color1,
    color2,
    flash,
    setColor1,
    setColor1Input,
    setColor2,
    setColor2Input,
    triggerFeedback,
    triggerFieldFeedback,
  ]);

  const applyPrimaryColor = useCallback((next) => {
    setColor1(normalizeHexColor(next, color1));
    triggerFeedback("color-primary", "success", 140);
  }, [color1, setColor1, triggerFeedback]);

  const applySecondaryColor = useCallback((next) => {
    setColor2(normalizeHexColor(next, color2));
    triggerFeedback("color-secondary", "success", 140);
  }, [color2, setColor2, triggerFeedback]);

  const swapColors = useCallback(() => {
    setColor1(color2);
    setColor2(color1);
    triggerFeedback("swap-colors", "success", 140);
  }, [color1, color2, setColor1, setColor2, triggerFeedback]);

  const beginControlTx = useCallback((layerId) => {
    controlTxRef.current = {
      layerId,
      snapshot: capturePatchSnapshot([layerId], true),
      dirty: false,
    };
  }, [capturePatchSnapshot, controlTxRef]);

  const endControlTx = useCallback((meta = { selectedShape }) => {
    if (!controlTxRef.current) return;
    const { layerId, snapshot, dirty } = controlTxRef.current;
    controlTxRef.current = null;
    if (!dirty) return;
    commitPatchHistory(snapshot, [layerId], meta);
  }, [commitPatchHistory, controlTxRef, selectedShape]);

  const mutateLayerLive = useCallback((id, mutate) => {
    const layer = getLayer(id);
    if (!layer) return;
    mutate(layer);
    if (controlTxRef.current?.layerId === id) controlTxRef.current.dirty = true;
    syncEditor();
  }, [controlTxRef, getLayer, syncEditor]);

  const mutateShapeFieldLive = useCallback((field, rawValue) => {
    const record = findShapeRecord();
    if (!record) return;
    if (field === "fillOn") {
      record.shape.fill = rawValue ? normalizeHexColor(record.shape.fill || color1, color1) : null;
      if (controlTxRef.current?.layerId === record.layer.id) controlTxRef.current.dirty = true;
      syncEditor();
      return;
    }
    if (field === "strokeOn") {
      record.shape.stroke = rawValue ? normalizeHexColor(record.shape.stroke || color2, color2) : null;
      if (controlTxRef.current?.layerId === record.layer.id) controlTxRef.current.dirty = true;
      syncEditor();
      return;
    }
    if (field === "fill" || field === "stroke") {
      const next = normalizeHexColor(rawValue, field === "fill" ? (record.shape.fill || color1) : (record.shape.stroke || color2));
      record.shape[field] = next;
      if (controlTxRef.current?.layerId === record.layer.id) controlTxRef.current.dirty = true;
      syncEditor();
      return;
    }
    const text = `${rawValue ?? ""}`.trim();
    if (!text || text === "-") return;
    const value = Number(text);
    if (!Number.isFinite(value)) return;
    if (record.shape.type === "line") {
      if (["x1", "y1", "x2", "y2"].includes(field)) record.shape[field] = value;
      else if (field === "strokeWidth") record.shape.strokeWidth = Math.max(1, value);
    } else if (field === "x" || field === "y") {
      record.shape[field] = value;
    } else if (field === "strokeWidth") {
      record.shape.strokeWidth = Math.max(1, value);
    } else {
      record.shape[field] = Math.max(1, value);
    }
    if (controlTxRef.current?.layerId === record.layer.id) controlTxRef.current.dirty = true;
    syncEditor();
  }, [color1, color2, controlTxRef, findShapeRecord, syncEditor]);

  const beginLayerOpacityEdit = useCallback(() => {
    if (!activeId || controlTxRef.current?.layerId === activeId) return;
    beginControlTx(activeId);
  }, [activeId, beginControlTx, controlTxRef]);

  const handleLayerOpacityInput = useCallback((rawValue) => {
    const nextValue = clamp(Number(rawValue) || 0, 0, 100);
    setOpacityDraft(nextValue);
    beginLayerOpacityEdit();
    mutateLayerLive(activeId, layer => { layer.opacity = nextValue / 100; });
  }, [activeId, beginLayerOpacityEdit, mutateLayerLive, setOpacityDraft]);

  const commitLayerOpacityEdit = useCallback(() => {
    const current = getLayer(activeId);
    endControlTx();
    setOpacityDraft(current ? Math.round(current.opacity * 100) : null);
    triggerFeedback("layer-opacity", "success", 140);
  }, [activeId, endControlTx, getLayer, setOpacityDraft, triggerFeedback]);

  const beginSelectionFieldEdit = useCallback(() => {
    const record = findShapeRecord();
    if (!record || controlTxRef.current?.layerId === record.layer.id) return;
    beginControlTx(record.layer.id);
  }, [beginControlTx, controlTxRef, findShapeRecord]);

  const handleSelectionFieldInput = useCallback((field, rawValue) => {
    setSelectionDraft(prev => ({ ...(prev || {}), [field]: rawValue }));
    beginSelectionFieldEdit();
    mutateShapeFieldLive(field, rawValue);
  }, [beginSelectionFieldEdit, mutateShapeFieldLive, setSelectionDraft]);

  const commitSelectionFieldEdits = useCallback(() => {
    const record = findShapeRecord();
    endControlTx();
    setSelectionDraft(shapeToDraft(record?.shape));
    triggerFeedback("shape-edit", "success", 140);
  }, [endControlTx, findShapeRecord, setSelectionDraft, shapeToDraft, triggerFeedback]);

  return {
    commitColor,
    applyPrimaryColor,
    applySecondaryColor,
    swapColors,
    beginLayerOpacityEdit,
    handleLayerOpacityInput,
    commitLayerOpacityEdit,
    beginSelectionFieldEdit,
    handleSelectionFieldInput,
    commitSelectionFieldEdits,
  };
}
