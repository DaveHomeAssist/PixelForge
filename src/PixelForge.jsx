import { useState, useRef, useEffect, useCallback, useMemo, useEffectEvent } from "react";
import "./PixelForge.css";
import EditorMenu from "./components/EditorMenu.jsx";
import SelectionSection from "./components/SelectionSection.jsx";
import PaletteSection from "./components/PaletteSection.jsx";
import LayersSection from "./components/LayersSection.jsx";
import ToolSettingsSection from "./components/ToolSettingsSection.jsx";
import TextPropertiesSection from "./components/TextPropertiesSection.jsx";
import DraftRecoveryBanner from "./components/DraftRecoveryBanner.jsx";
import NewDocumentModal from "./components/NewDocumentModal.jsx";
import ResizeDocumentModal from "./components/ResizeDocumentModal.jsx";
import StatusBar from "./components/StatusBar.jsx";
import TextEditOverlay from "./components/TextEditOverlay.jsx";
import AISettingsModal from "./components/AISettingsModal.jsx";
import AIGenerateModal from "./components/AIGenerateModal.jsx";
import ContextMenu from "./components/ContextMenu.jsx";
import ExportModal from "./components/ExportModal.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import useEditorPrefs from "./hooks/useEditorPrefs.js";
import useAutosaveRecovery from "./hooks/useAutosaveRecovery.js";
import useHistory from "./hooks/useHistory.js";
import useLayerOps from "./hooks/useLayerOps.js";
import useDocumentController from "./hooks/useDocumentController.js";
import useCanvasInteractions from "./hooks/useCanvasInteractions.js";
import useEditorControls from "./hooks/useEditorControls.js";
import useToolSelection from "./hooks/useToolSelection.js";
import useDerivedState from "./hooks/useDerivedState.js";

import {
  DEFAULT_W, DEFAULT_H, MIN_ZOOM, MAX_ZOOM,
  DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_BG, MOBILE_BREAKPOINT,
  TOOLS,
} from "./constants.js";
import {
  uid, clamp, normalizeHexColor, isEditableTarget,
  cloneShape, mergePrefs, getToolRequirement,
} from "./utils.js";
import { renderEditor } from "./render.js";
import { commitFloat } from "./marquee.js";
import { cropToRect, trimTransparent, rotateCanvas, flipCanvas } from "./canvasOps.js";
import { hitShape } from "./shapes.js";
import { applyImageEffect, blurImageData, sharpenImageData } from "./imageEffects.js";
import { clearSelectionPixels, cloneImageData, imageDataToFile, readSelectionImageData } from "./clipboard.js";

/* Inlined constants, utilities, shapes, serialization, autosave, and CSS
   have been extracted to their own modules — see imports above. */

export default function PixelForge() {
  /* ─── State ─── */
  const [tool, setTool] = useState("brush");
  const [brushSize, setBrushSize] = useState(10);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [brushPreset, setBrushPreset] = useState("soft");
  const [bucketTolerance, setBucketTolerance] = useState(16);
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
  const [isDragHover, setIsDragHover] = useState(false);
  const [editingText, setEditingText] = useState(null); // { layerId } | null
  const [selectionMask, setSelectionMask] = useState(null); // { layerId, rect, floating } | null
  const [aiModal, setAiModal] = useState(null); // null | "generate" | "settings"
  const [contextMenu, setContextMenu] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [clipboardStatus, setClipboardStatus] = useState(null);

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
  const zoomRef = useRef(zoom);
  const fitZoomRef = useRef(null);
  const fitObservedRef = useRef(false);
  const feedbackTimer = useRef(null);
  const fieldFeedbackTimer = useRef(null);
  const controlTxRef = useRef(null);
  const bumpScheduledRef = useRef(false);
  const clipboardRef = useRef(null); // { imageData, w, h } | null
  const longPressRef = useRef(null);

  const flash = useCallback((message, tone = "info", ms = 2000) => {
    setToast({ message, tone });
    window.clearTimeout(newToast.current);
    newToast.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  const bump = useCallback(() => {
    if (bumpScheduledRef.current) return;
    bumpScheduledRef.current = true;
    requestAnimationFrame(() => {
      bumpScheduledRef.current = false;
      setTick(t => t + 1);
    });
  }, []);
  const markDirty = useCallback(() => {
    setIsDirty(true);
    setDocVersion(v => v + 1);
  }, []);

  const syncMeta = useCallback(() => {
    const d = doc.current;
    setLayers(d.order.map(id => {
      const l = d.layers[id];
      const meta = {
        id: l.id, name: l.name, type: l.type, visible: l.visible,
        opacity: l.opacity, blend: l.blend, locked: l.locked,
        ox: l.ox, oy: l.oy,
        effect: l.effect || null,
        maskEnabled: !!l.maskEnabled,
        clipToBelow: !!l.clipToBelow,
        contentHint: l.type === "raster" ? (l.contentHint || "edited") : undefined,
        shapeCount: l.type === "vector" ? l.shapes.length : 0,
      };
      if (l.type === "text") {
        meta.text = l.text;
        meta.fontFamily = l.fontFamily;
        meta.fontSize = l.fontSize;
        meta.fontWeight = l.fontWeight;
        meta.italic = l.italic;
        meta.color = l.color;
        meta.align = l.align;
        meta.maxWidth = l.maxWidth;
      }
      return meta;
    }));
  }, []);

  const syncEditor = useCallback(() => {
    syncMeta();
    bump();
  }, [bump, syncMeta]);

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
    if (shape.type === "line" || shape.type === "path") {
      return {
        x1: String(Math.round(shape.x1)),
        y1: String(Math.round(shape.y1)),
        x2: String(Math.round(shape.x2)),
        y2: String(Math.round(shape.y2)),
        stroke: shape.stroke || "",
        strokeOn: !!shape.stroke,
        strokeWidth: String(Math.round(shape.strokeWidth || 2)),
      };
    }
    return {
      x: String(Math.round(shape.x)),
      y: String(Math.round(shape.y)),
      w: String(Math.round(shape.w)),
      h: String(Math.round(shape.h)),
      fill: shape.fill || "",
      fillOn: !!shape.fill,
      stroke: shape.stroke || "",
      strokeOn: !!shape.stroke,
      strokeWidth: String(Math.round(shape.strokeWidth || 2)),
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

  const fitViewTo = useCallback((w, h) => {
    if (!vpRef.current) return;
    const vw = vpRef.current.clientWidth;
    const vh = vpRef.current.clientHeight;
    const s = Math.min((vw - 80) / w, (vh - 80) / h, 1.75);
    fitZoomRef.current = s;
    setZoom(s);
    setPan({ x: (vw - w * s) / 2, y: (vh - h * s) / 2 });
  }, []);

  const {
    prefs,
    updatePrefs,
  } = useEditorPrefs({
    brushSize,
    brushOpacity,
    brushPreset,
    strokeW,
    fillOn,
    strokeOn,
    bucketTolerance,
    color1,
    color2,
    tool,
    mobilePanelTab,
    setBrushSize,
    setBrushOpacity,
    setBrushPreset,
    setStrokeW,
    setFillOn,
    setStrokeOn,
    setBucketTolerance,
    setColor1,
    setColor2,
    setDocForm,
    setResizeForm,
    setMobilePanelTab,
  });
  const preferredRasterTool = getToolRequirement(prefs.toolPrefs.lastRasterTool) === "raster" ? prefs.toolPrefs.lastRasterTool : "brush";
  const preferredVectorTool = getToolRequirement(prefs.toolPrefs.lastVectorTool) === "vector" ? prefs.toolPrefs.lastVectorTool : "rect";
  const workspace = useMemo(() => ({
    showGrid: !!prefs.uiPrefs.showGrid,
    showRulers: !!prefs.uiPrefs.showRulers,
    snapToGrid: !!prefs.uiPrefs.snapToGrid,
    pixelPreview: !!prefs.uiPrefs.pixelPreview,
    darkMode: !!prefs.uiPrefs.darkMode,
  }), [prefs.uiPrefs.darkMode, prefs.uiPrefs.pixelPreview, prefs.uiPrefs.showGrid, prefs.uiPrefs.showRulers, prefs.uiPrefs.snapToGrid]);
  const toggleWorkspacePref = useCallback((key) => {
    updatePrefs(prev => mergePrefs(prev, { uiPrefs: { [key]: !prev.uiPrefs[key] } }));
  }, [updatePrefs]);
  const isSectionCollapsed = useCallback((sectionId) => !!prefs.uiPrefs.collapsedSections?.[sectionId], [prefs.uiPrefs.collapsedSections]);
  const toggleSection = useCallback((sectionId) => {
    updatePrefs(prev => {
      const collapsedSections = prev.uiPrefs.collapsedSections || {};
      return mergePrefs(prev, {
        uiPrefs: {
          collapsedSections: {
            ...collapsedSections,
            [sectionId]: !collapsedSections[sectionId],
          },
        },
      });
    });
  }, [updatePrefs]);

  const {
    selectTool,
    focusLayerId,
    focusLayerType,
    pickLikelyLayerId,
    pulseLayer,
    intentLayerId,
    intentLayerTone,
  } = useToolSelection({
    layers,
    activeId,
    isCompactUI,
    prefs,
    setActiveId,
    setTool,
    setMobilePanelTab,
    updatePrefs,
    triggerFeedback,
  });

  const canEditLayer = useCallback((layer, actionLabel = "edit") => {
    if (!layer) return false;
    if (!layer.locked) return true;
    pulseLayer(layer.id, "error");
    flash(`${layer.name} is locked. Unlock it to ${actionLabel}.`, "error");
    return false;
  }, [flash, pulseLayer]);

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
    handleViewportDrop,
    handleClipboardPaste,
    handleClipboardRead,
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

  const onCreateText = useCallback((at) => {
    const newId = addTextLayerAt(at);
    if (newId) setEditingText({ layerId: newId });
  }, [addTextLayerAt]);

  const handleAIResult = useCallback(async (blob, promptText) => {
    const name = `AI: ${(promptText || "result").slice(0, 28)}`;
    await handleClipboardPaste(new File([blob], `${name}.png`, { type: blob.type || "image/png" }));
  }, [handleClipboardPaste]);

  const editingLayer = editingText ? layers.find(l => l.id === editingText.layerId) : null;
  const commitEditingText = useCallback((nextText) => {
    if (!editingText) return;
    const id = editingText.layerId;
    setEditingText(null);
    const layer = doc.current.layers[id];
    if (!layer) return;
    const trimmed = (nextText || "").trim();
    if (!trimmed) {
      // Empty commit → delete the layer
      delLayer(id);
      return;
    }
    if (layer.text !== nextText) updateTextLayer(id, { text: nextText });
  }, [delLayer, editingText, updateTextLayer]);

  const cancelEditingText = useCallback(() => {
    if (!editingText) return;
    const id = editingText.layerId;
    const layer = doc.current.layers[id];
    setEditingText(null);
    if (layer && (!layer.text || !layer.text.trim())) delLayer(id);
  }, [delLayer, editingText]);

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
    workspace,
    zoom,
    pan,
    brushSize,
    brushOpacity,
    brushPreset,
    bucketTolerance,
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
    setIsPanning,
    setPan,
    setZoom,
    bump,
    flash,
    triggerFeedback,
    onCreateText,
    selectionMask,
    setSelectionMask,
  });

  const {
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
  } = useEditorControls({
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
  });

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors color1 prop into a separate "editing draft" input. Phase 2 refactor target.
  useEffect(() => { setColor1Input(color1); }, [color1]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors color2 prop into a separate "editing draft" input. Phase 2 refactor target.
  useEffect(() => { setColor2Input(color2); }, [color2]);
  useEffect(() => {
    const current = layers.find(layer => layer.id === activeId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds the layer-name text input from the active layer. Phase 2 refactor target.
    setLayerNameInput(current?.name || "");
  }, [activeId, layers]);
  useEffect(() => {
    if (!selectedShape) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the selection draft when the selection is cleared. Phase 2 refactor target.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds the opacity-slider draft from active-layer opacity. Phase 2 refactor target.
    setOpacityDraft(current ? Math.round(current.opacity * 100) : null);
  }, [activeId, layers]);
  useEffect(() => () => window.clearTimeout(newToast.current), []);
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);
  useEffect(() => () => window.clearTimeout(fieldFeedbackTimer.current), []);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  /* eslint-disable react-hooks/set-state-in-effect -- derives selected-shape hover affordance from pointer and selection state. */
  useEffect(() => {
    if (!selectedShape) {
      setHoverHandle(null);
      return;
    }
    const record = findShapeRecord();
    if (!record || record.layer.id !== activeId) {
      setHoverHandle(null);
      return;
    }
    const hoverDocPoint = { x: (ts.current.scrX - pan.x) / zoom, y: (ts.current.scrY - pan.y) / zoom };
    setHoverHandle(getHandleAtPoint(record.shape, hoverDocPoint.x - record.layer.ox, hoverDocPoint.y - record.layer.oy));
  }, [activeId, findShapeRecord, getHandleAtPoint, pan.x, pan.y, selectedShape, tick, zoom]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  /* ─── Init ─── */
  useEffect(() => {
    resetDocument();
  }, [resetDocument]);

  /* ─── Render ─── */
  const renderFrame = useEffectEvent(() => {
    const activeLayerForRender = doc.current.layers[activeId];
    const selectedTextLayer = activeLayerForRender?.type === "text" && tool === "move"
      ? activeLayerForRender
      : null;
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
      selectedTextLayer,
      selectionMask,
      tool,
      brushSize,
      screenPoint: { x: ts.current.scrX, y: ts.current.scrY },
      isPanning: panning.current,
      workspace,
    });
  });

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => renderFrame());
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [activeId, brushSize, docH, docW, findShapeRecord, pan, renderFrame, selectionMask, tick, tool, zoom]);

  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const viewport = vpRef.current;
      if (!viewport) return;
      const hasSize = viewport.clientWidth > 0 && viewport.clientHeight > 0;
      if (hasSize && (!fitObservedRef.current || Math.abs(zoomRef.current - (fitZoomRef.current || 0)) < 0.001)) {
        fitObservedRef.current = true;
        fitViewTo(docW, docH);
        return;
      }
      bump();
    });
    if (vpRef.current) obs.observe(vpRef.current);
    return () => obs.disconnect();
  }, [bump, docH, docW, fitViewTo]);

  // Animate marching ants while a selection exists
  useEffect(() => {
    if (!selectionMask) return undefined;
    let id = null;
    const loop = () => {
      bump();
      id = window.setTimeout(loop, 80);
    };
    id = window.setTimeout(loop, 80);
    return () => window.clearTimeout(id);
  }, [selectionMask, bump]);

  // Commit any floating selection pixels when switching away from selection tools
  const prevToolRef = useRef(tool);
  useEffect(() => {
    const wasMarquee = prevToolRef.current === "marquee" || prevToolRef.current === "lasso";
    const isMarquee = tool === "marquee" || tool === "lasso";
    if (wasMarquee && !isMarquee && selectionMask?.floating) {
      const layer = doc.current.layers[selectionMask.layerId];
      if (layer) {
        const before = capturePatchSnapshot([layer.id], true);
        commitFloat(layer, selectionMask.rect, selectionMask.floating);
        commitPatchHistory(before, [layer.id], { selectedShape });
      }
      setSelectionMask(null);
    }
    prevToolRef.current = tool;
  }, [tool, selectionMask, capturePatchSnapshot, commitPatchHistory, selectedShape]);

  /* ─── Undo / Redo ─── */
  const handleUndo = useCallback(() => {
    if (doUndo()) triggerFeedback("undo", "success", 140);
  }, [doUndo, triggerFeedback]);

  const handleRedo = useCallback(() => {
    if (doRedo()) triggerFeedback("redo", "success", 140);
  }, [doRedo, triggerFeedback]);

  const zoomIn = useCallback(() => {
    setZoom(z => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM));
    triggerFeedback("zoom-in", "success", 140);
  }, [triggerFeedback]);

  const zoomOut = useCallback(() => {
    setZoom(z => clamp(z * 0.8, MIN_ZOOM, MAX_ZOOM));
    triggerFeedback("zoom-out", "success", 140);
  }, [triggerFeedback]);

  const showBrushCursor = ["brush", "eraser"].includes(tool);
  const brushCursorSize = Math.max(1, brushSize * zoom);
  const brushCursorStyle = {
    position: "absolute",
    left: ts.current.scrX - brushCursorSize / 2,
    top: ts.current.scrY - brushCursorSize / 2,
    width: brushCursorSize,
    height: brushCursorSize,
    border: tool === "eraser" ? "1px solid rgba(37, 52, 63, 0.72)" : "1px solid rgba(42, 111, 151, 0.82)",
    borderRadius: "50%",
    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.78)",
    pointerEvents: "none",
    transform: "translateZ(0)",
    zIndex: 3,
  };

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
  }, [canEditLayer, capturePatchSnapshot, commitPatchHistory, findShapeRecord, triggerFeedback]);

  const nudgeSelectedShape = useCallback((dx, dy) => {
    const record = findShapeRecord();
    if (!record || !canEditLayer(record.layer, "move this shape")) return;
    const before = capturePatchSnapshot([record.layer.id], true);
    if (record.shape.type === "line" || record.shape.type === "path") {
      record.shape.x1 += dx; record.shape.y1 += dy;
      record.shape.x2 += dx; record.shape.y2 += dy;
    } else {
      record.shape.x += dx;
      record.shape.y += dy;
    }
    commitPatchHistory(before, [record.layer.id], { selectedShape });
    triggerFeedback("shape-edit", "success", 140);
  }, [canEditLayer, capturePatchSnapshot, commitPatchHistory, findShapeRecord, selectedShape, triggerFeedback]);

  const syncSystemClipboardImage = useCallback(async (imageData) => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return;
    const file = await imageDataToFile(imageData);
    if (!file) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
    } catch {
      // Browser permission failures should not break PixelForge's internal paste.
    }
  }, []);

  const readMarqueeImageData = useCallback(() => {
    if (!selectionMask) return null;
    const layer = doc.current.layers[selectionMask.layerId];
    return readSelectionImageData(layer, selectionMask);
  }, [selectionMask]);

  const copyMarquee = useCallback(() => {
    const imageData = readMarqueeImageData();
    if (!imageData) {
      clipboardRef.current = null;
      return false;
    }
    clipboardRef.current = { imageData };
    setClipboardStatus(`${imageData.width}×${imageData.height} copied`);
    syncSystemClipboardImage(imageData);
    flash("Copied selection", "success", 1200);
    return true;
  }, [flash, readMarqueeImageData, syncSystemClipboardImage]);

  const cutMarquee = useCallback(() => {
    if (!selectionMask) return;
    const layer = doc.current.layers[selectionMask.layerId];
    if (!layer?.canvas) {
      clipboardRef.current = null;
      return;
    }
    const imageData = readMarqueeImageData();
    if (!imageData) {
      clipboardRef.current = null;
      return;
    }
    clipboardRef.current = { imageData };
    setClipboardStatus(`${imageData.width}×${imageData.height} cut`);
    syncSystemClipboardImage(imageData);
    const before = capturePatchSnapshot([layer.id], true);
    if (selectionMask.floating) {
      // float exists — discard (don't commit); but any prior lift already cleared pixels
    } else {
      clearSelectionPixels(layer, selectionMask);
    }
    commitPatchHistory(before, [layer.id], { selectedShape });
    setSelectionMask(null);
    flash("Cut selection", "success", 1200);
  }, [capturePatchSnapshot, commitPatchHistory, flash, readMarqueeImageData, selectedShape, selectionMask, syncSystemClipboardImage]);

  const pasteInternalClipboard = useCallback(async () => {
    const imageData = clipboardRef.current?.imageData;
    if (!imageData) return false;
    const layer = doc.current.layers[activeId];
    if (layer?.type === "raster" && !layer.locked) {
      const rect = {
        x: Math.max(0, Math.round((layer.canvas.width - imageData.width) / 2)),
        y: Math.max(0, Math.round((layer.canvas.height - imageData.height) / 2)),
        w: imageData.width,
        h: imageData.height,
      };
      setSelectionMask({ layerId: layer.id, rect, floating: { imageData: cloneImageData(imageData), ox: 0, oy: 0 } });
      setSelectedShape(null);
      setTool("marquee");
      setActiveId(layer.id);
      setClipboardStatus(`${imageData.width}×${imageData.height} pasted`);
      flash("Pasted selection into active layer", "success", 1400);
      return true;
    }
    const file = await imageDataToFile(imageData);
    if (!file) return false;
    const pasted = await handleClipboardPaste(file);
    if (pasted) setClipboardStatus(`${imageData.width}×${imageData.height} pasted as layer`);
    return pasted;
  }, [activeId, flash, handleClipboardPaste, setTool]);

  const pasteClipboard = useCallback(async () => {
    if (await pasteInternalClipboard()) return true;
    return handleClipboardRead();
  }, [handleClipboardRead, pasteInternalClipboard]);

  useEffect(() => {
    const onPaste = (e) => {
      if (isEditableTarget(e.target)) return;
      if (clipboardRef.current) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.kind === "file" && item.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          handleClipboardPaste(file);
          return;
        }
      }
      const files = Array.from(e.clipboardData?.files || []);
      const imageFile = files.find(f => f.type.startsWith("image/"));
      if (imageFile) {
        e.preventDefault();
        handleClipboardPaste(imageFile);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleClipboardPaste, pasteClipboard]);

  const deleteMarquee = useCallback(() => {
    if (!selectionMask) return;
    const layer = doc.current.layers[selectionMask.layerId];
    if (!layer) return;
    const before = capturePatchSnapshot([layer.id], true);
    if (!selectionMask.floating) {
      clearSelectionPixels(layer, selectionMask);
    }
    commitPatchHistory(before, [layer.id], { selectedShape });
    setSelectionMask(null);
  }, [capturePatchSnapshot, commitPatchHistory, selectedShape, selectionMask]);

  const nudgeMarquee = useCallback((dx, dy) => {
    if (!selectionMask) return;
    const layer = doc.current.layers[selectionMask.layerId];
    if (!layer) return;
    let floating = selectionMask.floating;
    if (!floating) {
      floating = {
        imageData: readSelectionImageData(layer, selectionMask),
        ox: 0, oy: 0,
      };
      clearSelectionPixels(layer, selectionMask);
    }
    setSelectionMask({
      ...selectionMask,
      floating: { imageData: floating.imageData, ox: floating.ox + dx, oy: floating.oy + dy },
    });
  }, [selectionMask]);

  const escapeMarquee = useCallback(() => {
    if (!selectionMask) return false;
    const layer = doc.current.layers[selectionMask.layerId];
    if (layer && selectionMask.floating) {
      const before = capturePatchSnapshot([layer.id], true);
      commitFloat(layer, selectionMask.rect, selectionMask.floating);
      commitPatchHistory(before, [layer.id], { selectedShape });
    }
    setSelectionMask(null);
    return true;
  }, [capturePatchSnapshot, commitPatchHistory, selectedShape, selectionMask]);

  const deleteSelectedShape = useCallback(() => {
    const record = findShapeRecord();
    if (!record || !canEditLayer(record.layer, "delete this shape")) return;
    const before = capturePatchSnapshot([record.layer.id], true);
    record.layer.shapes.splice(record.index, 1);
    setSelectedShape(null);
    commitPatchHistory(before, [record.layer.id], { selectedShape: null });
    triggerFeedback("shape-delete", "success");
  }, [canEditLayer, capturePatchSnapshot, commitPatchHistory, findShapeRecord, triggerFeedback]);

  const moveSelectedShapeOrder = useCallback((direction) => {
    const record = findShapeRecord();
    if (!record || !canEditLayer(record.layer, "reorder this shape")) return;
    const shapes = record.layer.shapes;
    let target = record.index;
    if (direction === "front") target = shapes.length - 1;
    else if (direction === "back") target = 0;
    else target = clamp(record.index + direction, 0, shapes.length - 1);
    if (target === record.index) return;
    const before = capturePatchSnapshot([record.layer.id], true);
    const [shape] = shapes.splice(record.index, 1);
    shapes.splice(target, 0, shape);
    commitPatchHistory(before, [record.layer.id], { selectedShape });
    syncEditor();
  }, [canEditLayer, capturePatchSnapshot, commitPatchHistory, findShapeRecord, selectedShape, syncEditor]);

  const selectAllActive = useCallback(() => {
    const layer = doc.current.layers[activeId];
    if (!layer) return;
    if (layer.type === "raster") {
      setSelectionMask({ layerId: layer.id, rect: { x: 0, y: 0, w: docW, h: docH }, floating: null });
      setSelectedShape(null);
      return;
    }
    if (layer.type === "vector" && layer.shapes.length) {
      const shape = layer.shapes[layer.shapes.length - 1];
      setSelectedShape({ layerId: layer.id, shapeId: shape.id });
      setSelectionMask(null);
    }
  }, [activeId, docH, docW]);

  const applyCanvasOperation = useCallback((operation, label) => {
    withFullHistory(() => {
      const result = operation(doc.current, docW, docH);
      setDocW(result.docW);
      setDocH(result.docH);
      setResizeForm(prev => ({ ...prev, width: result.docW, height: result.docH }));
      setSelectionMask(null);
      setSelectedShape(null);
      requestAnimationFrame(() => fitViewTo(result.docW, result.docH));
      return { docW: result.docW, docH: result.docH, selectedShape: null };
    });
    triggerFeedback("image-op", "success", 140);
    flash(label, "success", 1200);
  }, [docH, docW, fitViewTo, flash, setResizeForm, triggerFeedback, withFullHistory]);

  const cropSelection = useCallback(() => {
    if (!selectionMask) return;
    const layer = doc.current.layers[selectionMask.layerId];
    const ox = layer?.ox || 0;
    const oy = layer?.oy || 0;
    applyCanvasOperation((editorDoc, w, h) => cropToRect(editorDoc, w, h, {
      x: selectionMask.rect.x + ox,
      y: selectionMask.rect.y + oy,
      w: selectionMask.rect.w,
      h: selectionMask.rect.h,
    }), "Cropped to selection");
  }, [applyCanvasOperation, selectionMask]);

  const trimCanvas = useCallback(() => applyCanvasOperation(trimTransparent, "Trimmed transparent edges"), [applyCanvasOperation]);
  const rotateDocument = useCallback((degrees) => applyCanvasOperation((editorDoc, w, h) => rotateCanvas(editorDoc, w, h, degrees), "Canvas rotated"), [applyCanvasOperation]);
  const flipDocument = useCallback((axis) => applyCanvasOperation((editorDoc, w, h) => flipCanvas(editorDoc, w, h, axis), "Canvas flipped"), [applyCanvasOperation]);

  const applyActiveRasterImageData = useCallback((label, transform) => {
    const layer = doc.current.layers[activeId];
    if (!layer || layer.type !== "raster") {
      flash(`${label} needs an active raster layer.`, "error");
      return;
    }
    if (!canEditLayer(layer, label.toLowerCase())) return;
    const before = capturePatchSnapshot([layer.id]);
    const ctx = layer.canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.putImageData(transform(imageData), 0, 0);
    layer.contentHint = "edited";
    commitPatchHistory(before, [layer.id], { selectedShape });
    triggerFeedback("image-op", "success", 140);
    flash(label, "success", 1200);
  }, [activeId, canEditLayer, capturePatchSnapshot, commitPatchHistory, flash, selectedShape, triggerFeedback]);

  const applyAdjustment = useCallback((effect, amount, label) => {
    applyActiveRasterImageData(label, imageData => applyImageEffect(imageData, effect, amount));
  }, [applyActiveRasterImageData]);

  const applyFilter = useCallback((filter) => {
    const map = {
      blur: ["Blur applied", blurImageData],
      sharpen: ["Sharpen applied", sharpenImageData],
    };
    const entry = map[filter];
    if (!entry) return;
    applyActiveRasterImageData(entry[0], entry[1]);
  }, [applyActiveRasterImageData]);

  const toggleLayerFlag = useCallback((layerId, field, label) => {
    const layer = doc.current.layers[layerId || activeId];
    if (!layer) return;
    if (!canEditLayer(layer, label.toLowerCase())) return;
    const before = capturePatchSnapshot([layer.id], true);
    layer[field] = !layer[field];
    commitPatchHistory(before, [layer.id], { selectedShape });
    flash(label, "success", 1200);
  }, [activeId, canEditLayer, capturePatchSnapshot, commitPatchHistory, flash, selectedShape]);

  const setLayerEffect = useCallback((layerId, effect) => {
    const layer = doc.current.layers[layerId || activeId];
    if (!layer) return;
    if (!canEditLayer(layer, "set layer effect")) return;
    const before = capturePatchSnapshot([layer.id], true);
    layer.effect = layer.effect === effect ? null : effect;
    commitPatchHistory(before, [layer.id], { selectedShape });
    flash(layer.effect ? `Layer effect: ${effect}` : "Layer effect cleared", "success", 1200);
  }, [activeId, canEditLayer, capturePatchSnapshot, commitPatchHistory, flash, selectedShape]);

  const makeReferenceLayer = useCallback(() => {
    addLayer("raster");
    flash("Reference layer created", "success", 1200);
  }, [addLayer, flash]);

  const exportWithOptions = useCallback((options) => {
    const selectionLayer = selectionMask ? doc.current.layers[selectionMask.layerId] : null;
    const region = options.selectedOnly && selectionMask && selectionLayer
      ? {
          x: selectionMask.rect.x + (selectionLayer.ox || 0),
          y: selectionMask.rect.y + (selectionLayer.oy || 0),
          w: selectionMask.rect.w,
          h: selectionMask.rect.h,
        }
      : null;
    handleExport({ ...options, region });
    updatePrefs(prev => mergePrefs(prev, { docPrefs: { lastExport: options } }));
    setExportOpen(false);
  }, [handleExport, selectionMask, updatePrefs]);

  const quickExport = useCallback(() => {
    exportWithOptions(prefs.docPrefs.lastExport || { format: "png", scale: 1, includeBackground: true, filename: "pixelforge-export" });
  }, [exportWithOptions, prefs.docPrefs.lastExport]);

  const cancelLongPress = useCallback(() => {
    if (!longPressRef.current) return;
    window.clearTimeout(longPressRef.current.timer);
    longPressRef.current = null;
  }, []);

  const startLongPress = useCallback((e, openMenu) => {
    if (e.pointerType !== "touch") return;
    cancelLongPress();
    const startX = e.clientX;
    const startY = e.clientY;
    longPressRef.current = {
      startX,
      startY,
      timer: window.setTimeout(() => {
        longPressRef.current = null;
        openMenu(startX, startY);
      }, 500),
    };
  }, [cancelLongPress]);

  const moveLongPress = useCallback((e) => {
    const state = longPressRef.current;
    if (!state) return;
    if (Math.abs(e.clientX - state.startX) > 5 || Math.abs(e.clientY - state.startY) > 5) cancelLongPress();
  }, [cancelLongPress]);

  useEffect(() => () => cancelLongPress(), [cancelLongPress]);

  const findShapeAtViewportPoint = useCallback((clientX, clientY) => {
    const rect = cvRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const docX = (clientX - rect.left - pan.x) / zoom;
    const docY = (clientY - rect.top - pan.y) / zoom;
    for (const layer of [...layers].reverse()) {
      if (layer.type !== "vector" || layer.visible === false) continue;
      const lx = docX - (layer.ox || 0);
      const ly = docY - (layer.oy || 0);
      for (let i = layer.shapes.length - 1; i >= 0; i -= 1) {
        const shape = layer.shapes[i];
        if (hitShape(shape, lx, ly)) return { layer, shape };
      }
    }
    return null;
  }, [layers, pan.x, pan.y, zoom]);

  const viewportContextItems = useCallback((shapeSelection = selectedShape) => [
    ...(shapeSelection ? [
      { label: "Edit Fill", onClick: () => setMobilePanelTab("selection") },
      { label: "Edit Stroke", onClick: () => setMobilePanelTab("selection") },
      { separator: true },
      { label: "Bring Forward", onClick: () => moveSelectedShapeOrder(1) },
      { label: "Send Backward", onClick: () => moveSelectedShapeOrder(-1) },
      { label: "Bring To Front", onClick: () => moveSelectedShapeOrder("front") },
      { label: "Send To Back", onClick: () => moveSelectedShapeOrder("back") },
      { separator: true },
      { label: "Duplicate", onClick: duplicateSelectedShape },
      { label: "Delete", onClick: deleteSelectedShape, danger: true },
      { separator: true },
    ] : []),
    { label: "Paste", onClick: pasteClipboard },
    { label: "Select All", onClick: selectAllActive },
    { label: "Fit To View", onClick: handleFitView },
    { separator: true },
    { label: "New Raster Layer", onClick: () => addLayer("raster") },
    { label: "New Vector Layer", onClick: () => addLayer("vector") },
    { separator: true },
    { label: "Crop To Selection", onClick: cropSelection, disabled: !selectionMask },
    { label: "Trim Transparent Edges", onClick: trimCanvas },
  ], [addLayer, cropSelection, deleteSelectedShape, duplicateSelectedShape, handleFitView, moveSelectedShapeOrder, pasteClipboard, selectAllActive, selectedShape, selectionMask, setMobilePanelTab, trimCanvas]);

  const canMergeLayerDown = useCallback((layerId) => {
    const index = layers.findIndex(layer => layer.id === layerId);
    const upper = layers[index];
    const lower = layers[index - 1];
    return !!upper && !!lower && upper.type === "raster" && lower.type === "raster";
  }, [layers]);

  const layerContextItems = useCallback((layerId) => [
    { label: "Rename", onClick: () => { setActiveId(layerId); flash("Edit the layer name field to rename.", "info", 1200); } },
    { label: "Duplicate", onClick: () => duplicateLayer(layerId) },
    { label: "Delete", onClick: () => delLayer(layerId), danger: true, disabled: layers.length <= 1 },
    { separator: true },
    { label: "Move Up", onClick: () => moveLayer(layerId, 1) },
    { label: "Move Down", onClick: () => moveLayer(layerId, -1) },
    { label: "Move To Top", onClick: () => moveLayer(layerId, "top") },
    { label: "Move To Bottom", onClick: () => moveLayer(layerId, "bottom") },
    { separator: true },
    { label: "Toggle Visibility", onClick: () => toggleVis(layerId) },
    { label: "Toggle Lock", onClick: () => toggleLock(layerId) },
    { label: "Merge Down", onClick: () => mergeLayerDown(layerId), disabled: layerId !== activeId || !canMergeLayerDown(layerId) },
    { separator: true },
    { label: "Toggle Mask", onClick: () => toggleLayerFlag(layerId, "maskEnabled", "Layer mask toggled") },
    { label: "Toggle Clipping", onClick: () => toggleLayerFlag(layerId, "clipToBelow", "Clipping mask toggled") },
    { label: "Drop Shadow", onClick: () => setLayerEffect(layerId, "shadow") },
    { label: "Glow", onClick: () => setLayerEffect(layerId, "glow") },
    { label: "Blur Effect", onClick: () => setLayerEffect(layerId, "blur") },
  ], [activeId, canMergeLayerDown, delLayer, duplicateLayer, flash, layers.length, mergeLayerDown, moveLayer, setActiveId, setLayerEffect, toggleLayerFlag, toggleLock, toggleVis]);

  /* ─── Keyboard ─── */
  useEffect(() => {
    const kd = (e) => {
      const typing = isEditableTarget(e.target);
      const key = e.key.toLowerCase();
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
          setSelectionMask(null);
          clearSelection();
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
  }, [activeId, clearSelection, copyMarquee, cutMarquee, deleteMarquee, deleteSelectedShape, duplicateActiveLayer, duplicateSelectedShape, escapeMarquee, handleFitView, handleRedo, handleSave, handleUndo, moveLayer, nudgeMarquee, nudgeSelectedShape, selectAllActive, selectTool, selectedShape, selectionMask, swapColors, zoomIn, zoomOut]);

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
  const {
    activeLayer,
    selectedShapeFields,
    toolMeta,
    hoverToolMeta,
    panelToolMeta,
    panelToolCopy,
    toolCompatible,
    canMoveDown,
    canMoveUp,
    canMergeDown,
    suggestedLayerId,
    suggestedLayer,
    recentColors,
    recentBrushSizes,
    recentDocPresets,
    layerOpacityValue,
    hasArtwork,
    visibleNextActions,
    cursorStyle,
    showNextSection,
    showStarterOverlay,
    showDesktopSection,
  } = useDerivedState({
    layers,
    activeId,
    tool,
    hoverToolId,
    selectedShape,
    selectionDraft,
    opacityDraft,
    isCompactUI,
    isPanning,
    isSpaceHeld,
    hoverHandle,
    mobilePanelTab,
    prefs,
    isDirty,
    modal,
    starterDismissed,
    preferredRasterTool,
    preferredVectorTool,
    pickLikelyLayerId,
    focusLayerId,
    focusLayerType,
    selectTool,
    duplicateSelectedShape,
    addLayer,
    handleImportImage,
    handleExport,
    handleSave,
    canUseFileSave,
    setMobilePanelTab,
    setStarterDismissed,
  });

  const commandItems = useMemo(() => [
    { id: "cmd-bright", label: "Brightness +18", group: "Adjustments", run: () => applyAdjustment("brightness", 18, "Brightness adjusted") },
    { id: "cmd-contrast", label: "Contrast +28", group: "Adjustments", run: () => applyAdjustment("contrast", 28, "Contrast adjusted") },
    { id: "cmd-huesat", label: "Saturation +24", group: "Adjustments", run: () => applyAdjustment("hue-sat", 24, "Saturation adjusted") },
    { id: "cmd-invert", label: "Invert", group: "Adjustments", run: () => applyAdjustment("invert", 0, "Inverted colors") },
    { id: "cmd-gray", label: "Grayscale", group: "Adjustments", run: () => applyAdjustment("grayscale", 0, "Converted to grayscale") },
    { id: "cmd-sepia", label: "Sepia", group: "Adjustments", run: () => applyAdjustment("sepia", 0, "Sepia applied") },
    { id: "cmd-threshold", label: "Threshold", group: "Adjustments", run: () => applyAdjustment("threshold", 128, "Threshold applied") },
    { id: "cmd-posterize", label: "Posterize", group: "Adjustments", run: () => applyAdjustment("posterize", 4, "Posterize applied") },
    { id: "cmd-blur", label: "Gaussian Blur", group: "Filters", run: () => applyFilter("blur") },
    { id: "cmd-sharpen", label: "Sharpen", group: "Filters", run: () => applyFilter("sharpen") },
    { id: "cmd-grid", label: workspace.showGrid ? "Hide Grid" : "Show Grid", group: "View", run: () => toggleWorkspacePref("showGrid") },
    { id: "cmd-rulers", label: workspace.showRulers ? "Hide Rulers" : "Show Rulers", group: "View", run: () => toggleWorkspacePref("showRulers") },
    { id: "cmd-snap", label: workspace.snapToGrid ? "Disable Snap" : "Enable Snap", group: "View", run: () => toggleWorkspacePref("snapToGrid") },
    { id: "cmd-pixel", label: workspace.pixelPreview ? "Disable Pixel Preview" : "Enable Pixel Preview", group: "View", run: () => toggleWorkspacePref("pixelPreview") },
    { id: "cmd-dark", label: workspace.darkMode ? "Light Mode" : "Dark Mode", group: "View", run: () => toggleWorkspacePref("darkMode") },
    { id: "cmd-history", label: "Open History Panel", group: "Workspace", run: () => setHistoryOpen(true) },
    { id: "cmd-reference", label: "Add Reference Layer", group: "Workspace", run: makeReferenceLayer },
    { id: "cmd-mask", label: "Toggle Layer Mask", group: "Layer", run: () => toggleLayerFlag(activeId, "maskEnabled", "Layer mask toggled"), disabled: !activeId },
    { id: "cmd-clip", label: "Toggle Clipping Mask", group: "Layer", run: () => toggleLayerFlag(activeId, "clipToBelow", "Clipping mask toggled"), disabled: !activeId },
    { id: "cmd-shadow", label: "Toggle Drop Shadow", group: "Layer Effects", run: () => setLayerEffect(activeId, "shadow"), disabled: !activeId },
    { id: "cmd-glow", label: "Toggle Glow", group: "Layer Effects", run: () => setLayerEffect(activeId, "glow"), disabled: !activeId },
    { id: "cmd-effect-blur", label: "Toggle Layer Blur", group: "Layer Effects", run: () => setLayerEffect(activeId, "blur"), disabled: !activeId },
  ], [activeId, applyAdjustment, applyFilter, makeReferenceLayer, setLayerEffect, toggleLayerFlag, toggleWorkspacePref, workspace.darkMode, workspace.pixelPreview, workspace.showGrid, workspace.showRulers, workspace.snapToGrid]);

  /* ═══════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════ */
  return (
    <div className={`pf ${workspace.darkMode ? "pf-dark" : ""}`}>
      <input ref={fileRef} type="file" accept=".pforge,.json" style={{ display: "none" }} onChange={onFileChange} />
      <input ref={importRef} type="file" accept="image/*,.svg,image/svg+xml" style={{ display: "none" }} onChange={onImportImageChange} />

      {/* ── Menu Bar ── */}
      <EditorMenu
        feedbackClass={feedbackClass}
        handleNewDocument={openNewDocument}
        handleImportImage={handleImportImage}
        handlePaste={pasteClipboard}
        onResizeDocument={openResizeDocument}
        handleLoad={handleLoad}
        handleSave={handleSave}
        handleOpenExport={() => setExportOpen(true)}
        handleQuickExport={quickExport}
        handleOpenAIGenerate={() => setAiModal("generate")}
        imageActions={{
          canCrop: !!selectionMask,
          crop: cropSelection,
          trim: trimCanvas,
          rotate: rotateDocument,
          flip: flipDocument,
        }}
        editActions={{
          adjust: (effect) => applyAdjustment(effect, 0, `${effect} applied`),
          filter: applyFilter,
        }}
        workspaceActions={{
          toggle: toggleWorkspacePref,
        }}
        openCommandPalette={() => setCommandOpen(true)}
        openHistoryPanel={() => setHistoryOpen(true)}
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
        <div ref={vpRef} className={`pf-viewport ${isDragHover ? "pf-viewport-drag-hover" : ""}`} style={{ cursor: cursorStyle }}
          onPointerDown={e => {
            onDown(e);
            startLongPress(e, (x, y) => {
              const record = findShapeAtViewportPoint(x, y);
              const shapeSelection = record ? { layerId: record.layer.id, shapeId: record.shape.id } : selectedShape;
              if (record) setSelectedShape(shapeSelection);
              setContextMenu({ x, y, items: viewportContextItems(shapeSelection) });
            });
          }}
          onPointerMove={e => {
            onMove(e);
            moveLongPress(e);
          }}
          onPointerUp={e => {
            onUp(e);
            cancelLongPress();
          }}
          onPointerLeave={e => {
            onUp(e);
            cancelLongPress();
          }}
          onPointerCancel={e => {
            onUp(e);
            cancelLongPress();
          }}
          onContextMenu={e => {
            e.preventDefault();
            const record = findShapeAtViewportPoint(e.clientX, e.clientY);
            const shapeSelection = record ? { layerId: record.layer.id, shapeId: record.shape.id } : selectedShape;
            if (record) setSelectedShape(shapeSelection);
            setContextMenu({ x: e.clientX, y: e.clientY, items: viewportContextItems(shapeSelection) });
          }}
          onDragOver={e => {
            const types = Array.from(e.dataTransfer?.types || []);
            if (!types.includes("Files")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!isDragHover) setIsDragHover(true);
          }}
          onDragLeave={e => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            setIsDragHover(false);
          }}
          onDrop={e => {
            e.preventDefault();
            setIsDragHover(false);
            handleViewportDrop(Array.from(e.dataTransfer?.files || []));
          }}>
          <canvas ref={cvRef} />
          {showBrushCursor && <div data-testid="pf-brush-cursor" style={brushCursorStyle} />}
          {editingLayer && editingLayer.type === "text" && (
            <TextEditOverlay
              key={editingLayer.id}
              layer={editingLayer}
              zoom={zoom}
              pan={pan}
              onCommit={commitEditingText}
              onCancel={cancelEditingText}
            />
          )}
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
              brushPreset={brushPreset}
              setBrushPreset={setBrushPreset}
              bucketTolerance={bucketTolerance}
              setBucketTolerance={setBucketTolerance}
              fillOn={fillOn}
              setFillOn={setFillOn}
              strokeOn={strokeOn}
              setStrokeOn={setStrokeOn}
              strokeW={strokeW}
              setStrokeW={setStrokeW}
              collapsed={isSectionCollapsed("tool")}
              onToggle={() => toggleSection("tool")}
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
              collapsed={isSectionCollapsed("selection")}
              onToggle={() => toggleSection("selection")}
            />
          )}

          {activeLayer?.type === "text" && showDesktopSection("tool") && (
            <TextPropertiesSection
              activeLayer={activeLayer}
              updateTextLayer={updateTextLayer}
              startEditingText={id => setEditingText({ layerId: id })}
              collapsed={isSectionCollapsed("text")}
              onToggle={() => toggleSection("text")}
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
              collapsed={isSectionCollapsed("palette")}
              onToggle={() => toggleSection("palette")}
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
              onLayerContextMenu={(e, layerId) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, items: layerContextItems(layerId) });
              }}
              onLayerLongPressStart={(e, layerId) => {
                startLongPress(e, (x, y) => setContextMenu({ x, y, items: layerContextItems(layerId) }));
              }}
              onLayerLongPressCancel={cancelLongPress}
              collapsed={isSectionCollapsed("layers")}
              onToggle={() => toggleSection("layers")}
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
        clipboardStatus={clipboardStatus}
      />

      {/* ── Toast ── */}
      {toast && <div className={`pf-toast ${toast.tone || "info"}`}>{toast.message}</div>}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      <ExportModal
        open={exportOpen}
        initialOptions={prefs.docPrefs.lastExport}
        selectionAvailable={!!selectionMask}
        onClose={() => setExportOpen(false)}
        onExport={exportWithOptions}
      />

      <CommandPalette
        open={commandOpen}
        commands={commandItems}
        onClose={() => setCommandOpen(false)}
      />

      <HistoryPanel
        open={historyOpen}
        undoN={undoN}
        redoN={redoN}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClose={() => setHistoryOpen(false)}
      />

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

      {aiModal === "generate" && (
        <AIGenerateModal
          onClose={() => setAiModal(null)}
          onOpenSettings={() => setAiModal("settings")}
          onResult={handleAIResult}
        />
      )}

      {aiModal === "settings" && (
        <AISettingsModal
          onClose={() => setAiModal(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
