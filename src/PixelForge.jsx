import { useState, useRef, useEffect, useCallback } from "react";
import "./PixelForge.css";
import EditorMenu from "./components/EditorMenu.jsx";
import SelectionSection from "./components/SelectionSection.jsx";
import PaletteSection from "./components/PaletteSection.jsx";
import LayersSection from "./components/LayersSection.jsx";
import ToolSettingsSection from "./components/ToolSettingsSection.jsx";
import DraftRecoveryBanner from "./components/DraftRecoveryBanner.jsx";
import NewDocumentModal from "./components/NewDocumentModal.jsx";
import ResizeDocumentModal from "./components/ResizeDocumentModal.jsx";
import StatusBar from "./components/StatusBar.jsx";
import useEditorPrefs from "./hooks/useEditorPrefs.js";
import useAutosaveRecovery from "./hooks/useAutosaveRecovery.js";
import useHistory from "./hooks/useHistory.js";
import useLayerOps from "./hooks/useLayerOps.js";
import useDocumentController from "./hooks/useDocumentController.js";
import useCanvasInteractions from "./hooks/useCanvasInteractions.js";

import {
  DEFAULT_W, DEFAULT_H, MIN_ZOOM, MAX_ZOOM,
  DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_BG, MOBILE_BREAKPOINT,
  TOOLS, TOOL_COPY, HEX_COLOR_RE,
} from "./constants.js";
import {
  uid, clamp, normalizeHexColor, isEditableTarget,
  cloneShape, mergePrefs, getToolRequirement,
} from "./utils.js";
import { getResizeCursor } from "./shapes.js";
import { renderEditor } from "./render.js";

/* Inlined constants, utilities, shapes, serialization, autosave, and CSS
   have been extracted to their own modules — see imports above. */


export default function PixelForge() {
  /* ─── State ─── */
  const [tool, setTool] = useState("brush");
  const [brushSize, setBrushSize] = useState(10);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [color1, setColor1] = useState(DEFAULT_PRIMARY);
  const [color2, setColor2] = useState(DEFAULT_SECONDARY);
  const [color1Input, setColor1Input] = useState(DEFAULT_PRIMARY);
  const [color2Input, setColor2Input] = useState(DEFAULT_SECONDARY);
  const [fillOn, setFillOn] = useState(true);
  const [strokeOn, setStrokeOn] = useState(true);
  const [strokeW, setStrokeW] = useState(2);
  const [layers, setLayers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [docW, setDocW] = useState(DEFAULT_W);
  const [docH, setDocH] = useState(DEFAULT_H);
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);
  const [docVersion, setDocVersion] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [modal, setModal] = useState(null);
  const [docForm, setDocForm] = useState({ width: DEFAULT_W, height: DEFAULT_H, background: DEFAULT_BG });
  const [resizeForm, setResizeForm] = useState({ width: DEFAULT_W, height: DEFAULT_H, anchor: "center" });
  const [layerNameInput, setLayerNameInput] = useState("");
  const [dragLayerId, setDragLayerId] = useState(null);
  const [mobilePanelTab, setMobilePanelTab] = useState("next");
  const [isCompactUI, setIsCompactUI] = useState(false);
  const [intentLayerId, setIntentLayerId] = useState(null);
  const [intentLayerTone, setIntentLayerTone] = useState("suggested");
  const [lastLayerByType, setLastLayerByType] = useState({ raster: null, vector: null });
  const [starterDismissed, setStarterDismissed] = useState(false);
  const [feedbackState, setFeedbackState] = useState({ scope: null, tone: "idle" });
  const [fieldFeedback, setFieldFeedback] = useState({ field: null, tone: "idle" });
  const [dragOverLayerId, setDragOverLayerId] = useState(null);
  const [hoverToolId, setHoverToolId] = useState(null);
  const [saveHandle, setSaveHandle] = useState(null);
  const [selectionDraft, setSelectionDraft] = useState(null);
  const [selectedShapeType, setSelectedShapeType] = useState(null);
  const [opacityDraft, setOpacityDraft] = useState(null);
  const [hoverHandle, setHoverHandle] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  /* ─── Refs ─── */
  const cvRef = useRef(null);
  const vpRef = useRef(null);
  const renderCacheRef = useRef({});
  const doc = useRef({ layers: {}, order: [] });
  const ts = useRef({
    down: false,
    lx: 0,
    ly: 0,
    sx: 0,
    sy: 0,
    preview: null,
    drag: null,
    saved: null,
    savedOx: 0,
    savedOy: 0,
    scrX: 0,
    scrY: 0,
    historyBefore: null,
    selectionHandle: null,
    startShape: null,
    moved: false,
    strokeBounds: null,
  });
  const fileRef = useRef(null);
  const importRef = useRef(null);
  const newToast = useRef(null);
  const space = useRef(false);
  const panning = useRef(false);
  const panSt = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const raf = useRef(null);
  const intentLayerTimer = useRef(null);
  const feedbackTimer = useRef(null);
  const fieldFeedbackTimer = useRef(null);
  const controlTxRef = useRef(null);

  const flash = useCallback((message, tone = "info", ms = 2000) => {
    setToast({ message, tone });
    window.clearTimeout(newToast.current);
    newToast.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  const bump = () => setTick(t => t + 1);
  const markDirty = useCallback(() => {
    setIsDirty(true);
    setDocVersion(v => v + 1);
  }, []);

  const syncMeta = useCallback(() => {
    const d = doc.current;
    setLayers(d.order.map(id => {
      const l = d.layers[id];
      return {
        id: l.id, name: l.name, type: l.type, visible: l.visible,
        opacity: l.opacity, blend: l.blend, locked: l.locked,
        contentHint: l.type === "raster" ? (l.contentHint || "edited") : undefined,
        shapeCount: l.type === "vector" ? l.shapes.length : 0,
      };
    }));
  }, []);

  const syncEditor = useCallback(() => {
    syncMeta();
    bump();
  }, [syncMeta]);

  const getLayer = useCallback((id) => doc.current.layers[id] || null, []);
  const findShapeRecord = useCallback((selection = selectedShape) => {
    if (!selection?.layerId || !selection?.shapeId) return null;
    const layer = doc.current.layers[selection.layerId];
    if (!layer || layer.type !== "vector") return null;
    const index = layer.shapes.findIndex(shape => shape.id === selection.shapeId);
    if (index === -1) return null;
    return { layer, shape: layer.shapes[index], index };
  }, [selectedShape]);

  const shapeToDraft = useCallback((shape) => {
    if (!shape) return null;
    if (shape.type === "line") {
      return {
        x1: String(Math.round(shape.x1)),
        y1: String(Math.round(shape.y1)),
        x2: String(Math.round(shape.x2)),
        y2: String(Math.round(shape.y2)),
      };
    }
    return {
      x: String(Math.round(shape.x)),
      y: String(Math.round(shape.y)),
      w: String(Math.round(shape.w)),
      h: String(Math.round(shape.h)),
    };
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedShape(null);
  }, []);
  const triggerFeedback = useCallback((scope, tone = "success", ms = 180) => {
    setFeedbackState({ scope, tone });
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedbackState({ scope: null, tone: "idle" }), ms);
  }, []);
  const feedbackClass = useCallback((scope) => feedbackState.scope === scope ? `pf-feedback-${feedbackState.tone}` : "", [feedbackState]);
  const triggerFieldFeedback = useCallback((field, tone = "error", ms = 180) => {
    setFieldFeedback({ field, tone });
    window.clearTimeout(fieldFeedbackTimer.current);
    fieldFeedbackTimer.current = window.setTimeout(() => setFieldFeedback({ field: null, tone: "idle" }), ms);
  }, []);
  const fieldFeedbackClass = useCallback((field) => fieldFeedback.field === field ? `pf-field-${fieldFeedback.tone}` : "", [fieldFeedback]);

  const {
    undoN, redoN,
    capturePatchSnapshot,
    pushHistory, withFullHistory, commitPatchHistory,
    doUndo, doRedo, clearHistory,
  } = useHistory({
    docRef: doc,
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
  });

  function fitViewTo(w, h) {
    if (!vpRef.current) return;
    const vw = vpRef.current.clientWidth;
    const vh = vpRef.current.clientHeight;
    const s = Math.min((vw - 80) / w, (vh - 80) / h, 1.75);
    setZoom(s);
    setPan({ x: (vw - w * s) / 2, y: (vh - h * s) / 2 });
  }

  const {
    prefs,
    updatePrefs,
  } = useEditorPrefs({
    brushSize,
    brushOpacity,
    strokeW,
    fillOn,
    strokeOn,
    color1,
    color2,
    tool,
    mobilePanelTab,
    setBrushSize,
    setBrushOpacity,
    setStrokeW,
    setFillOn,
    setStrokeOn,
    setColor1,
    setColor2,
    setDocForm,
    setResizeForm,
    setMobilePanelTab,
  });
  const preferredRasterTool = getToolRequirement(prefs.toolPrefs.lastRasterTool) === "raster" ? prefs.toolPrefs.lastRasterTool : "brush";
  const preferredVectorTool = getToolRequirement(prefs.toolPrefs.lastVectorTool) === "vector" ? prefs.toolPrefs.lastVectorTool : "rect";

  const {
    recoveryDraft,
    clearRecoveryDraft,
  } = useAutosaveRecovery({
    isDirty,
    docVersion,
    docW,
    docH,
    activeId,
    selectedShape,
    docRef: doc,
    flash,
  });

  const {
    resetDocument,
    openNewDocument,
    openResizeDocument,
    handleSave,
    handleLoad,
    onFileChange,
    handleImportImage,
    onImportImageChange,
    applyResizeCanvas,
    applyNewDocument,
    recoverDraftProject,
    discardRecoveredDraft,
    handleExport,
    canUseFileSave,
    saveButtonLabel,
    saveButtonTitle,
  } = useDocumentController({
    docRef: doc,
    renderCacheRef,
    fileRef,
    importRef,
    docState: {
      docW,
      docH,
      activeId,
      selectedShape,
      saveHandle,
      isDirty,
      isCompactUI,
      docForm,
      resizeForm,
      recoveryDraft,
      preferredRasterTool,
    },
    prefs,
    stateSetters: {
      setDocW,
      setDocH,
      setActiveId,
      setSelectedShape,
      setResizeForm,
      setTool,
      setBrushSize,
      setBrushOpacity,
      setFillOn,
      setStrokeOn,
      setStrokeW,
      setColor1,
      setColor2,
      setStarterDismissed,
      setIsDirty,
      setLastSavedAt,
      setSaveHandle,
      setModal,
      setMobilePanelTab,
      setDocForm,
    },
    historyApi: {
      clearHistory,
      syncEditor,
      withFullHistory,
    },
    viewportApi: {
      fitViewTo,
    },
    feedbackApi: {
      flash,
      triggerFeedback,
      triggerFieldFeedback,
    },
    prefsApi: {
      updatePrefs,
    },
    recoveryApi: {
      clearRecoveryDraft,
    },
  });

  const {
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
  } = useLayerOps({
    docRef: doc,
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
  });

  const {
    getHandleAtPoint,
    onDown,
    onMove,
    onUp,
  } = useCanvasInteractions({
    cvRef,
    vpRef,
    tsRef: ts,
    spaceRef: space,
    panningRef: panning,
    panStateRef: panSt,
    docRef: doc,
    activeId,
    selectedShape,
    tool,
    zoom,
    pan,
    brushSize,
    brushOpacity,
    color1,
    color2,
    fillOn,
    strokeOn,
    strokeW,
    getLayer,
    findShapeRecord,
    clearSelection,
    canEditLayer,
    capturePatchSnapshot,
    commitPatchHistory,
    pushHistory,
    syncEditor,
    setSelectedShape,
    setColor1,
    setPan,
    setZoom,
    bump,
    flash,
    triggerFeedback,
  });

  useEffect(() => { setColor1Input(color1); }, [color1]);
  useEffect(() => { setColor2Input(color2); }, [color2]);
  useEffect(() => {
    const current = layers.find(layer => layer.id === activeId);
    setLayerNameInput(current?.name || "");
  }, [activeId, layers]);
  useEffect(() => {
    if (!selectedShape) {
      setSelectionDraft(null);
      setSelectedShapeType(null);
      return;
    }
    const record = findShapeRecord();
    setSelectionDraft(shapeToDraft(record?.shape));
    setSelectedShapeType(record?.shape?.type || null);
  }, [findShapeRecord, selectedShape, shapeToDraft]);
  useEffect(() => {
    const current = layers.find(layer => layer.id === activeId);
    setOpacityDraft(current ? Math.round(current.opacity * 100) : null);
  }, [activeId, layers]);
  useEffect(() => () => window.clearTimeout(newToast.current), []);
  useEffect(() => () => window.clearTimeout(intentLayerTimer.current), []);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);
  useEffect(() => () => window.clearTimeout(fieldFeedbackTimer.current), []);

  // Sync ref-based cursor state for render-safe access (effects may read refs)
  useEffect(() => {
    setIsPanning(panning.current);
    setIsSpaceHeld(space.current);
    if (!selectedShape) { setHoverHandle(null); return; }
    const record = findShapeRecord();
    if (!record || record.layer.id !== activeId) { setHoverHandle(null); return; }
    const hoverDocPoint = { x: (ts.current.scrX - pan.x) / zoom, y: (ts.current.scrY - pan.y) / zoom };
    setHoverHandle(getHandleAtPoint(record.shape, hoverDocPoint.x - record.layer.ox, hoverDocPoint.y - record.layer.oy));
  }, [activeId, findShapeRecord, getHandleAtPoint, pan.x, pan.y, selectedShape, tick, zoom]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const sync = () => setIsCompactUI(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  function commitColor(which, value) {
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
  }

  function applyPrimaryColor(next) {
    setColor1(normalizeHexColor(next, color1));
    triggerFeedback("color-primary", "success", 140);
  }

  function applySecondaryColor(next) {
    setColor2(normalizeHexColor(next, color2));
    triggerFeedback("color-secondary", "success", 140);
  }

  function swapColors() {
    setColor1(color2);
    setColor2(color1);
    triggerFeedback("swap-colors", "success", 140);
  }

  /* ─── Init ─── */
  useEffect(() => {
    resetDocument();
  }, [resetDocument]);

  /* ─── Render ─── */
  const render = useCallback(() => {
    renderEditor({
      canvas: cvRef.current,
      viewport: vpRef.current,
      renderCache: renderCacheRef.current,
      pan,
      zoom,
      docW,
      docH,
      editorDoc: doc.current,
      previewShape: ts.current.preview,
      selectedShapeRecord: findShapeRecord(),
      tool,
      brushSize,
      screenPoint: { x: ts.current.scrX, y: ts.current.scrY },
      isPanning: panning.current,
    });
  }, [brushSize, docH, docW, findShapeRecord, pan, tick, tool, zoom]);

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(render);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [render]);

  useEffect(() => {
    const obs = new ResizeObserver(() => bump());
    if (vpRef.current) obs.observe(vpRef.current);
    return () => obs.disconnect();
  }, []);

  /* ─── Undo / Redo ─── */
  function handleUndo() {
    if (doUndo()) triggerFeedback("undo", "success", 140);
  }

  function handleRedo() {
    if (doRedo()) triggerFeedback("redo", "success", 140);
  }

  function zoomIn() {
    setZoom(z => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM));
    triggerFeedback("zoom-in", "success", 140);
  }

  function zoomOut() {
    setZoom(z => clamp(z * 0.8, MIN_ZOOM, MAX_ZOOM));
    triggerFeedback("zoom-out", "success", 140);
  }

  /* ─── Brush drawing ─── */
  function canEditLayer(layer, actionLabel = "edit") {
    if (!layer) return false;
    if (!layer.locked) return true;
    pulseLayer(layer.id, "error");
    flash(`${layer.name} is locked. Unlock it to ${actionLabel}.`, "error");
    return false;
  }

  function pulseLayer(id, tone = "suggested", ms = 180) {
    if (!id) return;
    if (tone === "suggested" && !prefs.behaviorPrefs.highlightLikelyLayer) return;
    setIntentLayerId(id);
    setIntentLayerTone(tone);
    window.clearTimeout(intentLayerTimer.current);
    intentLayerTimer.current = window.setTimeout(() => {
      setIntentLayerId(null);
      setIntentLayerTone("suggested");
    }, ms);
  }

  function pickLikelyLayerId(type, { includeLocked = false } = {}) {
    const seen = new Set();
    const ordered = [];
    const pushCandidate = (id) => {
      if (!id || seen.has(id)) return;
      const layer = layers.find(l => l.id === id);
      if (!layer || layer.type !== type) return;
      if (!includeLocked && layer.locked) return;
      seen.add(id);
      ordered.push(id);
    };
    pushCandidate(lastLayerByType[type]);
    pushCandidate(activeId);
    [...layers].reverse().forEach(l => pushCandidate(l.id));
    if (!ordered.length && !includeLocked) return pickLikelyLayerId(type, { includeLocked: true });
    return ordered[0] || null;
  }

  function focusLayerId(id, { pulse = true } = {}) {
    if (!id || !layers.some(l => l.id === id)) return null;
    setActiveId(id);
    if (pulse) pulseLayer(id, "suggested");
    return id;
  }

  function focusLayerType(type, options = {}) {
    const id = pickLikelyLayerId(type);
    if (!id) return null;
    return focusLayerId(id, options);
  }

  function selectTool(nextTool) {
    setTool(nextTool);
    triggerFeedback(`tool-${nextTool}`, "success", 140);
    const requiredType = getToolRequirement(nextTool);
    if (requiredType === "raster") {
      updatePrefs(prev => mergePrefs(prev, { toolPrefs: { lastRasterTool: nextTool } }));
    } else if (requiredType === "vector") {
      updatePrefs(prev => mergePrefs(prev, { toolPrefs: { lastVectorTool: nextTool } }));
    }
    if (prefs.behaviorPrefs.autoSwitchLayerForTool && requiredType) {
      const current = layers.find(l => l.id === activeId);
      if (!current || current.type !== requiredType) focusLayerType(requiredType);
    }
    if (isCompactUI && nextTool !== "move" && nextTool !== "eyedropper") {
      setMobilePanelTab("tool");
    }
  }


  function beginControlTx(layerId) {
    controlTxRef.current = { layerId, snapshot: capturePatchSnapshot([layerId], true), dirty: false };
  }

  function endControlTx(meta = { selectedShape }) {
    if (!controlTxRef.current) return;
    const { layerId, snapshot, dirty } = controlTxRef.current;
    controlTxRef.current = null;
    if (!dirty) return;
    commitPatchHistory(snapshot, [layerId], meta);
  }

  function mutateLayerLive(id, mutate) {
    const layer = getLayer(id);
    if (!layer) return;
    mutate(layer);
    if (controlTxRef.current?.layerId === id) controlTxRef.current.dirty = true;
    syncEditor();
  }

  function mutateShapeFieldLive(field, rawValue) {
    const text = `${rawValue ?? ""}`.trim();
    if (!text || text === "-") return;
    const value = Number(text);
    if (!Number.isFinite(value)) return;
    const record = findShapeRecord();
    if (!record) return;
    if (record.shape.type === "line") {
      record.shape[field] = value;
    } else if (field === "x" || field === "y") {
      record.shape[field] = value;
    } else {
      record.shape[field] = Math.max(1, value);
    }
    if (controlTxRef.current?.layerId === record.layer.id) controlTxRef.current.dirty = true;
    syncEditor();
  }

  function beginLayerOpacityEdit() {
    if (!activeId || controlTxRef.current?.layerId === activeId) return;
    beginControlTx(activeId);
  }

  function handleLayerOpacityInput(rawValue) {
    const nextValue = clamp(Number(rawValue) || 0, 0, 100);
    setOpacityDraft(nextValue);
    beginLayerOpacityEdit();
    mutateLayerLive(activeId, layer => { layer.opacity = nextValue / 100; });
  }

  function commitLayerOpacityEdit() {
    const current = getLayer(activeId);
    endControlTx();
    setOpacityDraft(current ? Math.round(current.opacity * 100) : null);
    triggerFeedback("layer-opacity", "success", 140);
  }

  function beginSelectionFieldEdit() {
    const record = findShapeRecord();
    if (!record || controlTxRef.current?.layerId === record.layer.id) return;
    beginControlTx(record.layer.id);
  }

  function handleSelectionFieldInput(field, rawValue) {
    setSelectionDraft(prev => ({ ...(prev || {}), [field]: rawValue }));
    beginSelectionFieldEdit();
    mutateShapeFieldLive(field, rawValue);
  }

  function commitSelectionFieldEdits() {
    const record = findShapeRecord();
    endControlTx();
    setSelectionDraft(shapeToDraft(record?.shape));
    triggerFeedback("shape-edit", "success", 140);
  }

  function duplicateShape(shape) {
    if (shape.type === "line") {
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

  function duplicateSelectedShape() {
    const record = findShapeRecord();
    if (!record || !canEditLayer(record.layer, "duplicate this shape")) return;
    const before = capturePatchSnapshot([record.layer.id], true);
    const nextShape = duplicateShape(record.shape);
    record.layer.shapes.push(nextShape);
    const nextSelection = { layerId: record.layer.id, shapeId: nextShape.id };
    setSelectedShape(nextSelection);
    commitPatchHistory(before, [record.layer.id], { selectedShape: nextSelection });
    triggerFeedback("shape-duplicate", "success");
  }

  function deleteSelectedShape() {
    const record = findShapeRecord();
    if (!record || !canEditLayer(record.layer, "delete this shape")) return;
    const before = capturePatchSnapshot([record.layer.id], true);
    record.layer.shapes.splice(record.index, 1);
    setSelectedShape(null);
    commitPatchHistory(before, [record.layer.id], { selectedShape: null });
    triggerFeedback("shape-delete", "success");
  }

  /* ─── Keyboard ─── */
  useEffect(() => {
    const kd = (e) => {
      const typing = isEditableTarget(e.target);
      const key = e.key.toLowerCase();
      if (e.code === "Space" && !typing) { space.current = true; e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && key === "z") { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "y") { e.preventDefault(); handleRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); handleSave(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "d" && !typing) {
        e.preventDefault();
        if (selectedShape) duplicateSelectedShape();
        else duplicateActiveLayer();
        return;
      }
      if (typing) return;
      const sc = { v:"move", b:"brush", e:"eraser", r:"rect", o:"ellipse", l:"line", i:"eyedropper" };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && sc[key]) selectTool(sc[key]);
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === "x") swapColors();
      if (e.key === "Escape") clearSelection();
      if ((e.key === "Delete" || e.key === "Backspace") && selectedShape) {
        e.preventDefault();
        deleteSelectedShape();
      }
      if (e.key === "[") setBrushSize(s => Math.max(1, s - 2));
      if (e.key === "]") setBrushSize(s => Math.min(200, s + 2));
    };
    const ku = (e) => { if (e.code === "Space") space.current = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [clearSelection, deleteSelectedShape, duplicateActiveLayer, duplicateSelectedShape, handleSave, selectedShape, swapColors]);

  function commitActiveLayerName() {
    if (!activeId) return;
    renameLayer(activeId, layerNameInput || activeLayer?.name || "Layer");
  }



  function onLayerDragStart(id) {
    setDragLayerId(id);
    setDragOverLayerId(null);
  }

  function onLayerDragEnd() {
    setDragLayerId(null);
    setDragOverLayerId(null);
  }

  function onLayerDragEnter(id, e) {
    e.preventDefault();
    if (dragLayerId && dragLayerId !== id) setDragOverLayerId(id);
  }

  function onLayerDragLeave(id) {
    if (dragOverLayerId === id) setDragOverLayerId(null);
  }

  function onLayerDrop(targetId) {
    if (!dragLayerId || dragLayerId === targetId) {
      setDragLayerId(null);
      setDragOverLayerId(null);
      return;
    }
    reorderLayer(dragLayerId, targetId);
    triggerFeedback("layers", "success");
    pulseLayer(targetId, "success");
    setDragLayerId(null);
    setDragOverLayerId(null);
  }

  function fitView() { fitViewTo(docW, docH); }
  function handleFitView() {
    fitView();
    triggerFeedback("zoom-fit", "success", 140);
  }

  /* ─── Derived ─── */
  const activeLayer = layers.find(l => l.id === activeId);
  const selectedShapeFields = selectionDraft;
  const toolMeta = TOOLS.find(t => t.id === tool) || TOOLS[0];
  const hoverToolMeta = TOOLS.find(t => t.id === hoverToolId) || null;
  const panelToolMeta = hoverToolMeta || toolMeta;
  const panelToolCopy = TOOL_COPY[panelToolMeta.id];
  const toolCompatible = !activeLayer || (activeLayer.type === "raster" ? toolMeta.raster : toolMeta.vector);
  const activeIndex = layers.findIndex(l => l.id === activeId);
  const canMoveDown = activeIndex > 0;
  const canMoveUp = activeIndex >= 0 && activeIndex < layers.length - 1;
  const canMergeDown = !!activeLayer && activeLayer.type === "raster" && activeIndex > 0 && layers[activeIndex - 1]?.type === "raster";
  const requiredLayerType = getToolRequirement(tool);
  const suggestedLayerId = requiredLayerType && activeLayer?.type !== requiredLayerType ? pickLikelyLayerId(requiredLayerType) : null;
  const suggestedLayer = suggestedLayerId ? layers.find(l => l.id === suggestedLayerId) : null;
  const recentColors = prefs.toolPrefs.recentColors || [DEFAULT_PRIMARY, DEFAULT_SECONDARY];
  const recentBrushSizes = prefs.toolPrefs.recentBrushSizes || [];
  const recentDocPresets = prefs.docPrefs.recentDocPresets || [];
  const layerOpacityValue = opacityDraft ?? (activeLayer ? Math.round(activeLayer.opacity * 100) : 100);
  const docSignals = layers.reduce((acc, layer) => {
    if (layer.type === "vector") {
      acc.vectorShapes += layer.shapeCount;
      return acc;
    }
    if (!["background", "empty"].includes(layer.contentHint || "edited")) acc.editedRasterLayers += 1;
    return acc;
  }, { vectorShapes: 0, editedRasterLayers: 0 });
  const isBlankDocument = docSignals.vectorShapes === 0 && docSignals.editedRasterLayers === 0;
  const hasArtwork = !isBlankDocument;
  /* eslint-disable react-hooks/refs -- refs are only read inside onClick callbacks, not during render */
  const nextActions = [];
  if (suggestedLayer) {
    nextActions.push({
      key: "switch-layer",
      label: `Switch to ${suggestedLayer.name}`,
      detail: `${toolMeta.label} belongs on a ${suggestedLayer.type} layer.`,
      onClick: () => focusLayerId(suggestedLayer.id),
    });
  }
  if (isBlankDocument) {
    nextActions.push(
      {
        key: "start-painting",
        label: "Start Painting",
        detail: `Jump into ${TOOLS.find(item => item.id === preferredRasterTool)?.label || "Brush"} on your raster layer.`,
        onClick: () => { focusLayerType("raster"); selectTool(preferredRasterTool); },
      },
      {
        key: "add-shape",
        label: "Add Shape",
        detail: `Switch to ${TOOLS.find(item => item.id === preferredVectorTool)?.label || "Rectangle"} on your vector layer.`,
        onClick: () => { focusLayerType("vector"); selectTool(preferredVectorTool); },
      },
      {
        key: "import-image",
        label: "Import Image",
        detail: "Bring in a reference, texture, or base image.",
        onClick: handleImportImage,
      },
    );
  } else if (selectedShape) {
    nextActions.push(
      {
        key: "move-selection",
        label: "Move Selection",
        detail: "Switch to the move tool and keep editing the active shape.",
        onClick: () => selectTool("move"),
      },
      {
        key: "duplicate-selection",
        label: "Duplicate Shape",
        detail: "Branch the selected shape before refining.",
        onClick: duplicateSelectedShape,
      },
      {
        key: "export-work",
        label: "Export PNG",
        detail: "Capture the current composition as an image.",
        onClick: handleExport,
      },
    );
  } else if (tool === "brush" || tool === "eraser") {
    nextActions.push(
      {
        key: "shape-pass",
        label: "Switch To Shapes",
        detail: "Block in geometry on the vector layer.",
        onClick: () => { focusLayerType("vector"); selectTool(preferredVectorTool); },
      },
      {
        key: "new-raster",
        label: "Add Raster Layer",
        detail: "Keep paint strokes separate from the background.",
        onClick: () => addLayer("raster"),
      },
    );
    if (isDirty) {
      nextActions.push({
        key: "save-progress",
        label: "Save Progress",
        detail: canUseFileSave ? "Write the project back to disk." : "Download the current project file.",
        onClick: handleSave,
      });
    }
  } else if (requiredLayerType === "vector") {
    nextActions.push(
      {
        key: "move-tool",
        label: "Adjust Placement",
        detail: "Use the move tool for handles and precise placement.",
        onClick: () => selectTool("move"),
      },
      {
        key: "export-work",
        label: "Export PNG",
        detail: "Preview the composition outside the editor.",
        onClick: handleExport,
      },
    );
  } else if (isDirty) {
    nextActions.push(
      {
        key: "save-progress",
        label: "Save Progress",
        detail: canUseFileSave ? "Write the current PixelForge project to disk." : "Download the current PixelForge project.",
        onClick: handleSave,
      },
      {
        key: "export-work",
        label: "Export PNG",
        detail: "Flatten the visible layers to an image.",
        onClick: handleExport,
      },
    );
  }
  /* eslint-enable react-hooks/refs */
  const visibleNextActions = nextActions.slice(0, 3);
  const cursorStyle = isPanning
    ? "grabbing"
    : isSpaceHeld
      ? "grab"
      : tool === "move" && hoverHandle
        ? getResizeCursor(hoverHandle)
        : tool === "move" && selectedShape
          ? "move"
          : tool === "eyedropper"
            ? "crosshair"
            : ["brush", "eraser", "rect", "ellipse", "line"].includes(tool)
              ? "none"
              : "default";
  const showNextSection = visibleNextActions.length > 0;
  const showStarterOverlay = isBlankDocument && prefs.behaviorPrefs.showStarterActions && !modal && !starterDismissed;
  const showDesktopSection = (section) => !isCompactUI || mobilePanelTab === section;

  useEffect(() => {
    const current = layers.find(l => l.id === activeId);
    if (!current?.type) return;
    setLastLayerByType(prev => prev[current.type] === current.id ? prev : { ...prev, [current.type]: current.id });
  }, [activeId, layers]);

  useEffect(() => {
    if (!isCompactUI) return;
    if (selectedShape) {
      setMobilePanelTab("selection");
      return;
    }
    if (!toolCompatible && suggestedLayer) {
      setMobilePanelTab("layers");
      return;
    }
    if (isBlankDocument) {
      setMobilePanelTab("next");
    }
  }, [isBlankDocument, isCompactUI, selectedShape, suggestedLayer, toolCompatible]);

  useEffect(() => {
    if (!isCompactUI) return;
    if (mobilePanelTab === "next" && !showNextSection) {
      setMobilePanelTab(selectedShape ? "selection" : "tool");
      return;
    }
    if (mobilePanelTab === "selection" && !selectedShape) {
      setMobilePanelTab(showNextSection ? "next" : "tool");
    }
  }, [isCompactUI, mobilePanelTab, selectedShape, showNextSection]);

  useEffect(() => {
    if (!isBlankDocument) setStarterDismissed(false);
  }, [isBlankDocument]);

  /* ═══════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════ */
  return (
    <div className="pf">
      <input ref={fileRef} type="file" accept=".pforge,.json" style={{ display: "none" }} onChange={onFileChange} />
      <input ref={importRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onImportImageChange} />

      {/* ── Menu Bar ── */}
      <EditorMenu
        feedbackClass={feedbackClass}
        handleNewDocument={openNewDocument}
        handleImportImage={handleImportImage}
        onResizeDocument={openResizeDocument}
        handleLoad={handleLoad}
        handleSave={handleSave}
        handleExport={handleExport}
        doUndo={handleUndo}
        doRedo={handleRedo}
        toolMeta={toolMeta}
        activeLayer={activeLayer}
        docW={docW}
        docH={docH}
        isDirty={isDirty}
        lastSavedAt={lastSavedAt}
        hasArtwork={hasArtwork}
        undoN={undoN}
        redoN={redoN}
        zoom={zoom}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        handleFitView={handleFitView}
        saveButtonLabel={saveButtonLabel}
        saveButtonTitle={saveButtonTitle}
        canUseFileSave={canUseFileSave}
      />

      {/* ── Body ── */}
      <div className="pf-body">

        {/* ── Toolbar ── */}
        <div className="pf-toolbar">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`pf-tbtn ${tool === t.id ? "active" : ""} ${activeLayer && !(activeLayer.type === "raster" ? t.raster : t.vector) ? "muted" : ""} ${feedbackClass(`tool-${t.id}`)}`}
              onClick={() => selectTool(t.id)}
              onMouseEnter={() => setHoverToolId(t.id)}
              onMouseLeave={() => setHoverToolId(null)}
              title={`${t.label} (${t.shortcut})`}
              aria-pressed={tool === t.id}
            >
              <t.icon size={16} />
              <span className="pf-shortcut">{t.shortcut}</span>
            </button>
          ))}
          <div className="pf-toolbar-sep" />
          <div className="pf-color-wells">
            <label className={`pf-color-well primary ${feedbackClass("color-primary")}`} title="Primary color">
              <span className="pf-color-button-label">P</span>
              <span className="pf-color-button-swatch" style={{ background: color1 }} />
              <input className="pf-color-input" type="color" value={normalizeHexColor(color1, DEFAULT_PRIMARY)} onChange={e => applyPrimaryColor(e.target.value)} aria-label="Choose primary color" />
            </label>
            <label className={`pf-color-well secondary ${feedbackClass("color-secondary")}`} title="Secondary color">
              <span className="pf-color-button-label">S</span>
              <span className="pf-color-button-swatch" style={{ background: color2 }} />
              <input className="pf-color-input" type="color" value={normalizeHexColor(color2, DEFAULT_SECONDARY)} onChange={e => applySecondaryColor(e.target.value)} aria-label="Choose secondary color" />
            </label>
            <button className={`pf-swap-colors ${feedbackClass("swap-colors")}`} onClick={swapColors} title="Swap colors (X)" aria-label="Swap primary and secondary colors">⇄</button>
          </div>
        </div>

        {/* ── Canvas Viewport ── */}
        <div ref={vpRef} className="pf-viewport" style={{ cursor: cursorStyle }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerCancel={onUp}
          onContextMenu={e => e.preventDefault()}>
          <canvas ref={cvRef} />
          {showStarterOverlay && (
            <div className="pf-starter">
              <div className="pf-starter-card">
                <div className="pf-starter-kicker">Starter Actions</div>
                <div className="pf-starter-title">Blank canvas, fast first move.</div>
                <div className="pf-starter-copy">
                  PixelForge can predict the next sensible step here. Start painting, switch to vector shapes, or import an image without hunting through the UI.
                </div>
                <div className="pf-starter-actions">
                  {visibleNextActions.map(action => (
                    <button key={action.key} className="pf-next-card" onClick={() => { setStarterDismissed(true); action.onClick(); }}>
                      <div className="pf-next-title">{action.label}</div>
                      <div className="pf-next-detail">{action.detail}</div>
                    </button>
                  ))}
                </div>
                <div className="pf-recent-row" style={{ marginTop: 14, marginBottom: 0 }}>
                  <button className="pf-chip-btn" onClick={() => { setStarterDismissed(true); updatePrefs(prev => mergePrefs(prev, { behaviorPrefs: { showStarterActions: false } })); }}>Hide Starter Tips</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="pf-rpanel">
          <DraftRecoveryBanner
            recoveryDraft={recoveryDraft}
            feedbackClass={feedbackClass}
            recoverDraftProject={recoverDraftProject}
            discardRecoveredDraft={discardRecoveredDraft}
          />

          <div className="pf-mobile-tabs">
            {showNextSection && <button className={`pf-mobile-tab ${mobilePanelTab === "next" ? "active" : ""}`} onClick={() => setMobilePanelTab("next")}>Next</button>}
            <button className={`pf-mobile-tab ${mobilePanelTab === "tool" ? "active" : ""}`} onClick={() => setMobilePanelTab("tool")}>Tool</button>
            {selectedShape && <button className={`pf-mobile-tab ${mobilePanelTab === "selection" ? "active" : ""}`} onClick={() => setMobilePanelTab("selection")}>Selection</button>}
            <button className={`pf-mobile-tab ${mobilePanelTab === "palette" ? "active" : ""}`} onClick={() => setMobilePanelTab("palette")}>Colors</button>
            <button className={`pf-mobile-tab ${mobilePanelTab === "layers" ? "active" : ""}`} onClick={() => setMobilePanelTab("layers")}>Layers</button>
          </div>

          {showNextSection && showDesktopSection("next") && (
            <div className="pf-section">
              <div className="pf-section-head">Suggested Next</div>
              <div className="pf-section-body">
                <div className="pf-next-grid">
                  {visibleNextActions.map(action => (
                    <button key={action.key} className="pf-next-card" onClick={action.onClick}>
                      <div className="pf-next-title">{action.label}</div>
                      <div className="pf-next-detail">{action.detail}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Properties */}
          {showDesktopSection("tool") && (
            <ToolSettingsSection
              panelToolCopy={panelToolCopy}
              panelToolMeta={panelToolMeta}
              hoverToolMeta={hoverToolMeta}
              tool={tool}
              toolMeta={toolMeta}
              activeLayer={activeLayer}
              toolCompatible={toolCompatible}
              suggestedLayer={suggestedLayer}
              focusLayerId={focusLayerId}
              recentBrushSizes={recentBrushSizes}
              setBrushSize={setBrushSize}
              brushSize={brushSize}
              brushOpacity={brushOpacity}
              setBrushOpacity={setBrushOpacity}
              fillOn={fillOn}
              setFillOn={setFillOn}
              strokeOn={strokeOn}
              setStrokeOn={setStrokeOn}
              strokeW={strokeW}
              setStrokeW={setStrokeW}
            />
          )}

          {selectedShape && selectedShapeType && showDesktopSection("selection") && (
            <SelectionSection
              selectedShapeType={selectedShapeType}
              selectedShapeFields={selectedShapeFields}
              beginSelectionFieldEdit={beginSelectionFieldEdit}
              handleSelectionFieldInput={handleSelectionFieldInput}
              commitSelectionFieldEdits={commitSelectionFieldEdits}
              duplicateSelectedShape={duplicateSelectedShape}
              deleteSelectedShape={deleteSelectedShape}
              feedbackClass={feedbackClass}
            />
          )}

          {/* Color Palette */}
          {showDesktopSection("palette") && (
            <PaletteSection
              recentColors={recentColors}
              color1={color1}
              color2={color2}
              color1Input={color1Input}
              color2Input={color2Input}
              setColor1Input={setColor1Input}
              setColor2Input={setColor2Input}
              applyPrimaryColor={applyPrimaryColor}
              applySecondaryColor={applySecondaryColor}
              commitColor={commitColor}
              feedbackClass={feedbackClass}
              fieldFeedbackClass={fieldFeedbackClass}
            />
          )}

          {/* Layers */}
          {showDesktopSection("layers") && (
            <LayersSection
              feedbackClass={feedbackClass}
              layers={layers}
              activeLayer={activeLayer}
              activeId={activeId}
              layerNameInput={layerNameInput}
              setLayerNameInput={setLayerNameInput}
              commitActiveLayerName={commitActiveLayerName}
              toggleLock={toggleLock}
              duplicateActiveLayer={duplicateActiveLayer}
              mergeLayerDown={mergeLayerDown}
              canMergeDown={canMergeDown}
              addLayer={addLayer}
              delLayer={delLayer}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              moveLayer={moveLayer}
              setBlend={setBlend}
              layerOpacityValue={layerOpacityValue}
              beginLayerOpacityEdit={beginLayerOpacityEdit}
              handleLayerOpacityInput={handleLayerOpacityInput}
              commitLayerOpacityEdit={commitLayerOpacityEdit}
              dragLayerId={dragLayerId}
              dragOverLayerId={dragOverLayerId}
              intentLayerId={intentLayerId}
              intentLayerTone={intentLayerTone}
              suggestedLayerId={suggestedLayerId}
              setActiveId={setActiveId}
              onLayerDragStart={onLayerDragStart}
              onLayerDragEnd={onLayerDragEnd}
              onLayerDragEnter={onLayerDragEnter}
              onLayerDragLeave={onLayerDragLeave}
              onLayerDrop={onLayerDrop}
              toggleVis={toggleVis}
            />
          )}
        </div>
      </div>

      <StatusBar
        docW={docW}
        docH={docH}
        zoom={zoom}
        activeLayer={activeLayer}
        toolMeta={toolMeta}
        isDirty={isDirty}
        lastSavedAt={lastSavedAt}
      />

      {/* ── Toast ── */}
      {toast && <div className={`pf-toast ${toast.tone || "info"}`}>{toast.message}</div>}

      <NewDocumentModal
        open={modal === "new-document"}
        docForm={docForm}
        setDocForm={setDocForm}
        recentDocPresets={recentDocPresets}
        fieldFeedbackClass={fieldFeedbackClass}
        feedbackClass={feedbackClass}
        closeModal={() => setModal(null)}
        applyNewDocument={applyNewDocument}
      />

      <ResizeDocumentModal
        open={modal === "resize-document"}
        resizeForm={resizeForm}
        setResizeForm={setResizeForm}
        feedbackClass={feedbackClass}
        closeModal={() => setModal(null)}
        applyResizeCanvas={applyResizeCanvas}
      />
    </div>
  );
}
