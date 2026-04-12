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

import {
  DEFAULT_W, DEFAULT_H, MIN_ZOOM, MAX_ZOOM,
  DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_BG, MOBILE_BREAKPOINT,
  TOOLS, TOOL_COPY, HEX_COLOR_RE,
} from "./constants.js";
import {
  uid, clamp, dist, lerp, rgbHex, normalizeHexColor, isEditableTarget,
  ensureShape, cloneShape, mergePrefs,
  getToolRequirement, extractRegion,
} from "./utils.js";
import {
  getShapeHandles, getResizeCursor,
  applyRectResize, applyLineHandle, hitShape,
} from "./shapes.js";
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
  const [opacityDraft, setOpacityDraft] = useState(null);

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
      return { id: l.id, name: l.name, type: l.type, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked };
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

  function s2d(sx, sy) {
    const r = cvRef.current?.getBoundingClientRect();
    return r ? { x: (sx - r.left - pan.x) / zoom, y: (sy - r.top - pan.y) / zoom } : { x: 0, y: 0 };
  }

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

  useEffect(() => { setColor1Input(color1); }, [color1]);
  useEffect(() => { setColor2Input(color2); }, [color2]);
  useEffect(() => {
    const current = layers.find(layer => layer.id === activeId);
    setLayerNameInput(current?.name || "");
  }, [activeId, layers]);
  useEffect(() => {
    if (!selectedShape) {
      setSelectionDraft(null);
      return;
    }
    const record = findShapeRecord();
    setSelectionDraft(shapeToDraft(record?.shape));
  }, [findShapeRecord, selectedShape, shapeToDraft]);
  useEffect(() => {
    const current = layers.find(layer => layer.id === activeId);
    setOpacityDraft(current ? Math.round(current.opacity * 100) : null);
  }, [activeId, layers]);
  useEffect(() => () => window.clearTimeout(newToast.current), []);
  useEffect(() => () => window.clearTimeout(intentLayerTimer.current), []);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);
  useEffect(() => () => window.clearTimeout(fieldFeedbackTimer.current), []);

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
  function stamp(ctx, x, y, sz, col, op, erase) {
    ctx.save();
    ctx.globalAlpha = op;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.fillStyle = erase ? "rgba(0,0,0,1)" : col;
    ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function brushLine(ctx, x0, y0, x1, y1, sz, col, op, erase) {
    const d = dist(x0, y0, x1, y1), step = Math.max(0.5, sz * 0.15);
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 0; i <= n; i++) { const t = i / n; stamp(ctx, lerp(x0, x1, t), lerp(y0, y1, t), sz, col, op, erase); }
  }

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
      const layer = doc.current.layers[id];
      if (!layer || layer.type !== type) return;
      if (!includeLocked && layer.locked) return;
      seen.add(id);
      ordered.push(id);
    };
    pushCandidate(lastLayerByType[type]);
    pushCandidate(activeId);
    [...doc.current.order].reverse().forEach(pushCandidate);
    if (!ordered.length && !includeLocked) return pickLikelyLayerId(type, { includeLocked: true });
    return ordered[0] || null;
  }

  function focusLayerId(id, { pulse = true } = {}) {
    if (!id || !doc.current.layers[id]) return null;
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
      const current = doc.current.layers[activeId];
      if (!current || current.type !== requiredType) focusLayerType(requiredType);
    }
    if (isCompactUI && nextTool !== "move" && nextTool !== "eyedropper") {
      setMobilePanelTab("tool");
    }
  }


  function commitRasterStroke(layerId) {
    const t = ts.current;
    if (!t.historyBefore?.layers?.[0]?.imageData || !t.strokeBounds) {
      commitPatchHistory(t.historyBefore, [layerId]);
      return;
    }
    const layer = getLayer(layerId);
    if (!layer?.canvas) {
      commitPatchHistory(t.historyBefore, [layerId]);
      return;
    }
    const bounds = t.strokeBounds;
    const cw = layer.canvas.width, ch = layer.canvas.height;
    const MARGIN = 2;
    const rx = Math.max(0, Math.floor(bounds.minX) - MARGIN);
    const ry = Math.max(0, Math.floor(bounds.minY) - MARGIN);
    const rx2 = Math.min(cw, Math.ceil(bounds.maxX) + MARGIN + 1);
    const ry2 = Math.min(ch, Math.ceil(bounds.maxY) + MARGIN + 1);
    const rw = rx2 - rx, rh = ry2 - ry;
    if (rw <= 0 || rh <= 0 || rw * rh > cw * ch * 0.5) {
      commitPatchHistory(t.historyBefore, [layerId]);
      return;
    }
    const region = { x: rx, y: ry, w: rw, h: rh };
    const beforeFull = t.historyBefore.layers[0].imageData;
    const beforeRegion = extractRegion(beforeFull, region);
    const afterRegion = layer.canvas.getContext("2d").getImageData(rx, ry, rw, rh);
    const meta = {
      id: layer.id, name: layer.name, type: "raster",
      visible: layer.visible, opacity: layer.opacity, blend: layer.blend,
      locked: !!layer.locked, contentHint: layer.contentHint || "edited",
      ox: layer.ox, oy: layer.oy,
    };
    const before = { mode: "patch", layers: [{ ...meta, region, imageData: beforeRegion }] };
    const after = { mode: "patch", layers: [{ ...meta, region, imageData: afterRegion }], activeId, selectedShape };
    pushHistory(before, after);
    syncEditor();
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


  function getHandleAtPoint(shape, px, py) {
    const radius = Math.max(6, 10 / zoom);
    return getShapeHandles(shape).find(handle => dist(handle.x, handle.y, px, py) <= radius)?.id || null;
  }

  /* ─── Pointer events ─── */
  function onDown(e) {
    e.preventDefault();
    const rect = cvRef.current?.getBoundingClientRect();
    if (rect) {
      ts.current.scrX = e.clientX - rect.left;
      ts.current.scrY = e.clientY - rect.top;
    }
    if (e.button === 1 || (e.button === 0 && space.current)) {
      panning.current = true;
      panSt.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
      return;
    }
    if (e.button !== 0) return;

    const p = s2d(e.clientX, e.clientY);
    const t = ts.current;
    t.down = true;
    t.sx = p.x;
    t.sy = p.y;
    t.lx = p.x;
    t.ly = p.y;
    t.preview = null;
    t.drag = null;
    t.historyBefore = null;
    t.selectionHandle = null;
    t.startShape = null;
    t.moved = false;
    t.strokeBounds = null;
    const layer = doc.current.layers[activeId];
    if (!layer) return;

    if (tool === "brush" || tool === "eraser") {
      if (!canEditLayer(layer, tool)) { t.down = false; return; }
      if (layer.type !== "raster") { triggerFeedback(`tool-${tool}`, "error"); flash("Select a raster layer for " + tool, "error"); t.down = false; return; }
      const c = layer.canvas.getContext("2d");
      t.historyBefore = capturePatchSnapshot([layer.id]);
      layer.contentHint = "edited";
      const sx = p.x - layer.ox, sy = p.y - layer.oy;
      const halfBrush = brushSize / 2;
      t.strokeBounds = { minX: sx - halfBrush, minY: sy - halfBrush, maxX: sx + halfBrush, maxY: sy + halfBrush };
      stamp(c, sx, sy, brushSize, color1, brushOpacity, tool === "eraser");
      bump();
    } else if (tool === "move") {
      if (layer.type === "vector") {
        const selectedRecord = findShapeRecord();
        if (selectedRecord?.layer.id === layer.id) {
          const handle = getHandleAtPoint(selectedRecord.shape, p.x - layer.ox, p.y - layer.oy);
          if (handle) {
            if (!canEditLayer(layer, "transform shapes")) { t.down = false; return; }
            t.selectionHandle = handle;
            t.drag = { shapeId: selectedRecord.shape.id };
            t.startShape = cloneShape(selectedRecord.shape);
            t.historyBefore = capturePatchSnapshot([layer.id], true);
            return;
          }
        }
        for (let i = layer.shapes.length - 1; i >= 0; i--) {
          if (hitShape(layer.shapes[i], p.x - layer.ox, p.y - layer.oy)) {
            const s = layer.shapes[i];
            const nextSelection = { layerId: layer.id, shapeId: s.id };
            setSelectedShape(nextSelection);
            if (layer.locked) { t.down = false; return; }
            t.drag = { shapeId: s.id };
            t.startShape = cloneShape(s);
            t.historyBefore = capturePatchSnapshot([layer.id], true, { selectedShape: nextSelection });
            break;
          }
        }
        if (!t.drag && !t.selectionHandle) clearSelection();
      }
      if (!t.drag && !t.selectionHandle) {
        if (!canEditLayer(layer, "move this layer")) { t.down = false; return; }
        t.savedOx = layer.ox;
        t.savedOy = layer.oy;
        t.historyBefore = capturePatchSnapshot([layer.id], true);
      }
    } else if (["rect","ellipse","line"].includes(tool)) {
      if (!canEditLayer(layer, "draw shapes")) { t.down = false; return; }
      if (layer.type !== "vector") { triggerFeedback(`tool-${tool}`, "error"); flash("Select a vector layer for shapes", "error"); t.down = false; return; }
      clearSelection();
      t.historyBefore = capturePatchSnapshot([layer.id], true, { selectedShape: null });
    } else if (tool === "eyedropper") {
      t.down = false;
      const cv = cvRef.current;
      if (cv) {
        const dpr = window.devicePixelRatio || 1;
        const r = cv.getBoundingClientRect();
        const px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr;
        const d = cv.getContext("2d").getImageData(px, py, 1, 1).data;
        if (d[3] > 0) {
          const h = rgbHex(d[0], d[1], d[2]);
          setColor1(h);
          triggerFeedback("color-primary", "success", 140);
          flash("Picked " + h, "success", 1200);
        }
      }
    }
  }

  function onMove(e) {
    const r = cvRef.current?.getBoundingClientRect();
    if (r) { ts.current.scrX = e.clientX - r.left; ts.current.scrY = e.clientY - r.top; }

    if (panning.current) {
      setPan({ x: panSt.current.ox + e.clientX - panSt.current.x, y: panSt.current.oy + e.clientY - panSt.current.y });
      return;
    }
    if (!ts.current.down) { if (["brush","eraser"].includes(tool)) bump(); return; }

    const p = s2d(e.clientX, e.clientY);
    const t = ts.current;
    const layer = doc.current.layers[activeId];
    if (!layer) return;

    if (tool === "brush" || tool === "eraser") {
      if (layer.type === "raster") {
        const x0 = t.lx - layer.ox, y0 = t.ly - layer.oy;
        const x1 = p.x - layer.ox, y1 = p.y - layer.oy;
        brushLine(layer.canvas.getContext("2d"), x0, y0, x1, y1, brushSize, color1, brushOpacity, tool === "eraser");
        if (t.strokeBounds) {
          const hb = brushSize / 2;
          t.strokeBounds.minX = Math.min(t.strokeBounds.minX, x0 - hb, x1 - hb);
          t.strokeBounds.minY = Math.min(t.strokeBounds.minY, y0 - hb, y1 - hb);
          t.strokeBounds.maxX = Math.max(t.strokeBounds.maxX, x0 + hb, x1 + hb);
          t.strokeBounds.maxY = Math.max(t.strokeBounds.maxY, y0 + hb, y1 + hb);
        }
        t.moved = true;
        bump();
      }
    } else if (tool === "move") {
      const dx = p.x - t.sx, dy = p.y - t.sy;
      if (dx || dy) t.moved = true;
      if (layer.type === "vector" && t.drag?.shapeId) {
        const record = findShapeRecord({ layerId: layer.id, shapeId: t.drag.shapeId });
        if (!record || !t.startShape) return;
        if (t.selectionHandle) {
          if (record.shape.type === "line") applyLineHandle(record.shape, t.selectionHandle, t.startShape, dx, dy);
          else applyRectResize(record.shape, t.selectionHandle, t.startShape, dx, dy);
        } else if (record.shape.type === "line") {
          record.shape.x1 = t.startShape.x1 + dx;
          record.shape.y1 = t.startShape.y1 + dy;
          record.shape.x2 = t.startShape.x2 + dx;
          record.shape.y2 = t.startShape.y2 + dy;
        } else {
          record.shape.x = t.startShape.x + dx;
          record.shape.y = t.startShape.y + dy;
        }
      } else {
        layer.ox = t.savedOx + dx;
        layer.oy = t.savedOy + dy;
      }
      bump();
    } else if (["rect","ellipse"].includes(tool)) {
      const ox = layer.ox, oy = layer.oy;
      t.preview = { type: tool, x: Math.min(t.sx, p.x) - ox, y: Math.min(t.sy, p.y) - oy, w: Math.abs(p.x - t.sx), h: Math.abs(p.y - t.sy), fill: fillOn ? color1 : null, stroke: strokeOn ? color2 : null, strokeWidth: strokeW };
      t.moved = true;
      bump();
    } else if (tool === "line") {
      t.preview = { type: "line", x1: t.sx - layer.ox, y1: t.sy - layer.oy, x2: p.x - layer.ox, y2: p.y - layer.oy, stroke: color1, strokeWidth: strokeW };
      t.moved = true;
      bump();
    }
    t.lx = p.x; t.ly = p.y;
  }

  function onUp() {
    if (panning.current) { panning.current = false; return; }
    const t = ts.current;
    if (!t.down) return;
    t.down = false;
    const layer = doc.current.layers[activeId];

    if ((tool === "brush" || tool === "eraser") && layer?.type === "raster" && t.historyBefore) {
      commitRasterStroke(layer.id);
    } else if (["rect","ellipse","line"].includes(tool) && layer?.type === "vector" && t.preview) {
      const shape = ensureShape({ ...t.preview });
      layer.shapes.push(shape);
      const nextSelection = { layerId: layer.id, shapeId: shape.id };
      setSelectedShape(nextSelection);
      commitPatchHistory(t.historyBefore, [layer.id], { selectedShape: nextSelection });
      t.preview = null;
    } else if (tool === "move" && layer) {
      if (t.historyBefore && t.moved) {
        commitPatchHistory(
          t.historyBefore,
          [layer.id],
          { selectedShape: t.drag?.shapeId ? { layerId: layer.id, shapeId: t.drag.shapeId } : selectedShape },
        );
      }
    }
    t.drag = null;
    t.selectionHandle = null;
    t.startShape = null;
    t.historyBefore = null;
    t.moved = false;
    t.strokeBounds = null;
    bump();
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

  /* ─── Wheel (attached imperatively for { passive: false }) ─── */
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const r = cvRef.current?.getBoundingClientRect();
      if (!r) return;
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom(prevZoom => {
        const nz = clamp(prevZoom * f, MIN_ZOOM, MAX_ZOOM);
        const k = nz / prevZoom;
        setPan(p => ({ x: mx - k * (mx - p.x), y: my - k * (my - p.y) }));
        return nz;
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

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
  const selectedShapeRecord = findShapeRecord();
  const selectedShapeFields = selectionDraft || shapeToDraft(selectedShapeRecord?.shape);
  const toolMeta = TOOLS.find(t => t.id === tool) || TOOLS[0];
  const hoverToolMeta = TOOLS.find(t => t.id === hoverToolId) || null;
  const panelToolMeta = hoverToolMeta || toolMeta;
  const panelToolCopy = TOOL_COPY[panelToolMeta.id];
  const toolCompatible = !activeLayer || (activeLayer.type === "raster" ? toolMeta.raster : toolMeta.vector);
  const activeIndex = activeId ? doc.current.order.indexOf(activeId) : -1;
  const canMoveDown = activeIndex > 0;
  const canMoveUp = activeIndex >= 0 && activeIndex < doc.current.order.length - 1;
  const canMergeDown = !!activeLayer && activeLayer.type === "raster" && activeIndex > 0 && doc.current.layers[doc.current.order[activeIndex - 1]]?.type === "raster";
  const requiredLayerType = getToolRequirement(tool);
  const suggestedLayerId = requiredLayerType && activeLayer?.type !== requiredLayerType ? pickLikelyLayerId(requiredLayerType) : null;
  const suggestedLayer = suggestedLayerId ? doc.current.layers[suggestedLayerId] : null;
  const recentColors = prefs.toolPrefs.recentColors || [DEFAULT_PRIMARY, DEFAULT_SECONDARY];
  const recentBrushSizes = prefs.toolPrefs.recentBrushSizes || [];
  const recentDocPresets = prefs.docPrefs.recentDocPresets || [];
  const layerOpacityValue = opacityDraft ?? (activeLayer ? Math.round(activeLayer.opacity * 100) : 100);
  const docSignals = doc.current.order.reduce((acc, id) => {
    const layer = doc.current.layers[id];
    if (!layer) return acc;
    if (layer.type === "vector") {
      acc.vectorShapes += layer.shapes.length;
      return acc;
    }
    if (!["background", "empty"].includes(layer.contentHint || "edited")) acc.editedRasterLayers += 1;
    return acc;
  }, { vectorShapes: 0, editedRasterLayers: 0 });
  const isBlankDocument = docSignals.vectorShapes === 0 && docSignals.editedRasterLayers === 0;
  const hasArtwork = !isBlankDocument;
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
  } else if (selectedShapeRecord) {
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
  const visibleNextActions = nextActions.slice(0, 3);
  const hoverDocPoint = { x: (ts.current.scrX - pan.x) / zoom, y: (ts.current.scrY - pan.y) / zoom };
  const hoverHandle = selectedShapeRecord && selectedShapeRecord.layer.id === activeId
    ? getHandleAtPoint(selectedShapeRecord.shape, hoverDocPoint.x - selectedShapeRecord.layer.ox, hoverDocPoint.y - selectedShapeRecord.layer.oy)
    : null;
  const cursorStyle = panning.current
    ? "grabbing"
    : space.current
      ? "grab"
      : tool === "move" && hoverHandle
        ? getResizeCursor(hoverHandle)
        : tool === "move" && selectedShapeRecord
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
    const current = doc.current.layers[activeId];
    if (!current?.type) return;
    setLastLayerByType(prev => prev[current.type] === current.id ? prev : { ...prev, [current.type]: current.id });
  }, [activeId, layers]);

  useEffect(() => {
    if (!isCompactUI) return;
    if (selectedShapeRecord) {
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
  }, [isBlankDocument, isCompactUI, selectedShapeRecord, suggestedLayer, toolCompatible]);

  useEffect(() => {
    if (!isCompactUI) return;
    if (mobilePanelTab === "next" && !showNextSection) {
      setMobilePanelTab(selectedShapeRecord ? "selection" : "tool");
      return;
    }
    if (mobilePanelTab === "selection" && !selectedShapeRecord) {
      setMobilePanelTab(showNextSection ? "next" : "tool");
    }
  }, [isCompactUI, mobilePanelTab, selectedShapeRecord, showNextSection]);

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
            {selectedShapeRecord && <button className={`pf-mobile-tab ${mobilePanelTab === "selection" ? "active" : ""}`} onClick={() => setMobilePanelTab("selection")}>Selection</button>}
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

          {selectedShapeRecord && showDesktopSection("selection") && (
            <SelectionSection
              selectedShapeRecord={selectedShapeRecord}
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
