import { useCallback } from "react";
import {
  DEFAULT_W, DEFAULT_H, DEFAULT_BG,
  DEFAULT_PRIMARY, DEFAULT_SECONDARY,
  HEX_COLOR_RE, RECENT_PRESETS_LIMIT,
} from "../constants.js";
import {
  clamp, makeCanvas, mergePrefs,
  normalizeHexColor, pushRecentPreset, getAnchorOffset,
} from "../utils.js";
import { drawShape } from "../shapes.js";
import { drawText } from "../text.js";
import {
  createDefaultDocument, buildProjectPayload, hydrateProject, hydrateDraftPayload,
} from "../serialization.js";
import { saveProjectPayload, supportsFileSave } from "../projectFiles.js";
import { createRasterLayerFromImage } from "../imageImport.js";

export default function useDocumentController({
  docRef,
  renderCacheRef,
  fileRef,
  importRef,
  docState,
  prefs,
  stateSetters,
  historyApi,
  viewportApi,
  feedbackApi,
  prefsApi,
  recoveryApi,
}) {
  const {
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
  } = docState;

  const {
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
  } = stateSetters;

  const {
    clearHistory,
    syncEditor,
    withFullHistory,
  } = historyApi;

  const { fitViewTo } = viewportApi;
  const { flash, triggerFeedback, triggerFieldFeedback } = feedbackApi;
  const { updatePrefs } = prefsApi;
  const { clearRecoveryDraft } = recoveryApi;

  const buildPayload = useCallback(
    () => buildProjectPayload(docRef.current, docW, docH, activeId, selectedShape),
    [activeId, docH, docRef, docW, selectedShape],
  );

  const markClean = useCallback(() => {
    setIsDirty(false);
    setLastSavedAt(Date.now());
    clearRecoveryDraft();
  }, [clearRecoveryDraft, setIsDirty, setLastSavedAt]);

  const applyProjectState = useCallback((project, { dirty = false, savedAt = null } = {}) => {
    docRef.current = project.doc;
    clearHistory();
    renderCacheRef.current = {};
    setDocW(project.docW);
    setDocH(project.docH);
    setActiveId(project.activeId);
    setSelectedShape(project.selectedShape || null);
    setResizeForm(prev => ({ ...prev, width: project.docW, height: project.docH }));
    syncEditor();
    requestAnimationFrame(() => fitViewTo(project.docW, project.docH));
    setIsDirty(dirty);
    setLastSavedAt(savedAt);
    setSaveHandle(null);
    if (!dirty) clearRecoveryDraft();
  }, [
    clearHistory,
    clearRecoveryDraft,
    docRef,
    fitViewTo,
    renderCacheRef,
    setActiveId,
    setDocH,
    setDocW,
    setIsDirty,
    setLastSavedAt,
    setResizeForm,
    setSaveHandle,
    setSelectedShape,
    syncEditor,
  ]);

  const resetDocument = useCallback((w = DEFAULT_W, h = DEFAULT_H, bgColor = DEFAULT_BG, { dirty = false } = {}) => {
    const next = createDefaultDocument(w, h, bgColor);
    docRef.current = next.doc;
    clearHistory();
    renderCacheRef.current = {};
    setDocW(w);
    setDocH(h);
    setActiveId(next.activeId);
    setSelectedShape(null);
    setTool("brush");
    setBrushSize(10);
    setBrushOpacity(1);
    setFillOn(true);
    setStrokeOn(true);
    setStrokeW(2);
    setColor1(DEFAULT_PRIMARY);
    setColor2(DEFAULT_SECONDARY);
    setResizeForm({ width: w, height: h, anchor: "center" });
    setStarterDismissed(false);
    syncEditor();
    requestAnimationFrame(() => fitViewTo(w, h));
    setIsDirty(dirty);
    setLastSavedAt(dirty ? null : Date.now());
    setSaveHandle(null);
    if (!dirty) clearRecoveryDraft();
  }, [
    clearHistory,
    clearRecoveryDraft,
    docRef,
    fitViewTo,
    renderCacheRef,
    setActiveId,
    setBrushOpacity,
    setBrushSize,
    setColor1,
    setColor2,
    setDocH,
    setDocW,
    setFillOn,
    setIsDirty,
    setLastSavedAt,
    setResizeForm,
    setSaveHandle,
    setSelectedShape,
    setStarterDismissed,
    setStrokeOn,
    setStrokeW,
    setTool,
    syncEditor,
  ]);

  const openNewDocument = useCallback(() => {
    setDocForm(prefs.docPrefs.lastNewDoc || { width: docW, height: docH, background: DEFAULT_BG });
    setModal("new-document");
  }, [docH, docW, prefs.docPrefs.lastNewDoc, setDocForm, setModal]);

  const openResizeDocument = useCallback(() => {
    setResizeForm({ width: docW, height: docH, anchor: prefs.docPrefs.lastResizeAnchor || "center" });
    setModal("resize-document");
  }, [docH, docW, prefs.docPrefs.lastResizeAnchor, setModal, setResizeForm]);

  const handleSave = useCallback(async () => {
    try {
      let hasBrowserKeys = false;
      try {
        const raw = window.localStorage.getItem("PixelForge.ai.v1");
        hasBrowserKeys = !!raw && (raw.includes("anthropicKey") || raw.includes("providerKey"));
      } catch {
        hasBrowserKeys = false;
      }
      const result = await saveProjectPayload(buildPayload(), saveHandle);
      if (result.mode === "file") {
        setSaveHandle(result.handle);
        markClean();
        triggerFeedback("save", "success");
        flash(hasBrowserKeys ? "Project saved. AI keys stay in this browser." : "Project saved", "success", hasBrowserKeys ? 3600 : 2000);
        return;
      }
      triggerFeedback("save", "success");
      flash(hasBrowserKeys ? "Project downloaded. AI keys stay in this browser." : "Project downloaded. Browser fallback does not mark the project as saved.", "success", hasBrowserKeys ? 3600 : 2600);
    } catch (err) {
      triggerFeedback("save", "error");
      flash("Save error: " + err.message, "error");
    }
  }, [buildPayload, flash, markClean, saveHandle, setSaveHandle, triggerFeedback]);

  const handleLoad = useCallback(() => {
    if (isDirty && !window.confirm("Open another project? Current unsaved changes will be kept only in the browser draft.")) return;
    fileRef.current?.click();
  }, [fileRef, isDirty]);

  const onFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const project = await hydrateProject(JSON.parse(text));
      setModal(null);
      applyProjectState(project, { dirty: false, savedAt: Date.now() });
      triggerFeedback("load", "success");
      flash("Loaded " + file.name, "success");
    } catch (err) {
      triggerFeedback("load", "error");
      flash("Load error: " + err.message, "error");
    }
    event.target.value = "";
  }, [applyProjectState, flash, setModal, triggerFeedback]);

  const handleImportImage = useCallback(() => {
    importRef.current?.click();
  }, [importRef]);

  const importImageFile = useCallback(async (file, { name, at } = {}) => {
    const layerName = name || file.name?.replace(/\.[^.]+$/, "") || "Imported Image";
    try {
      await createRasterLayerFromImage(file, {
        docRef, docW, docH,
        withFullHistory, setActiveId, setSelectedShape,
        name: layerName,
        at,
      });
      triggerFeedback("import", "success");
      flash("Imported " + (file.name || layerName), "success");
      return true;
    } catch (err) {
      triggerFeedback("import", "error");
      flash("Import error: " + err.message, "error");
      return false;
    }
  }, [docH, docRef, docW, flash, setActiveId, setSelectedShape, triggerFeedback, withFullHistory]);

  const onImportImageChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await importImageFile(file);
    event.target.value = "";
  }, [importImageFile]);

  const handleViewportDrop = useCallback(async (files) => {
    const images = (files || []).filter(f => f && f.type && f.type.startsWith("image/"));
    if (!images.length) {
      if ((files || []).length) {
        triggerFeedback("import", "error");
        flash("Drop an image file", "error");
      }
      return;
    }
    for (const file of images) {
      // sequential — each image gets its own history entry
      await importImageFile(file);
    }
  }, [flash, importImageFile, triggerFeedback]);

  const handleClipboardPaste = useCallback(async (file) => {
    if (!file) return false;
    return importImageFile(file, { name: "Pasted Image" });
  }, [importImageFile]);

  const handleClipboardRead = useCallback(async () => {
    if (!navigator.clipboard?.read) {
      flash("Clipboard image paste is unavailable here. Use Cmd+V on the canvas.", "info", 2600);
      return false;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        return handleClipboardPaste(new File([blob], "Pasted Image", { type: imageType }));
      }
      flash("Clipboard does not contain an image.", "info", 2200);
      return false;
    } catch {
      flash("Clipboard access was blocked. Use Cmd+V on the canvas.", "info", 2600);
      return false;
    }
  }, [flash, handleClipboardPaste]);

  const applyResizeCanvas = useCallback(() => {
    const nextW = clamp(Math.round(+resizeForm.width || docW), 64, 8192);
    const nextH = clamp(Math.round(+resizeForm.height || docH), 64, 8192);
    const { dx, dy } = getAnchorOffset(resizeForm.anchor, docW, docH, nextW, nextH);
    withFullHistory(() => {
      docRef.current.order.forEach(id => {
        const layer = docRef.current.layers[id];
        if (layer.type === "raster") {
          const oldCanvas = layer.canvas;
          const nextCanvas = makeCanvas(nextW, nextH);
          nextCanvas.getContext("2d").drawImage(oldCanvas, dx, dy);
          layer.canvas = nextCanvas;
          return;
        }
        layer.shapes.forEach(shape => {
          if (shape.type === "line" || shape.type === "path") {
            shape.x1 += dx;
            shape.y1 += dy;
            shape.x2 += dx;
            shape.y2 += dy;
            return;
          }
          shape.x += dx;
          shape.y += dy;
        });
      });
      setDocW(nextW);
      setDocH(nextH);
      setModal(null);
      requestAnimationFrame(() => fitViewTo(nextW, nextH));
      return { docW: nextW, docH: nextH, activeId, selectedShape };
    });
    updatePrefs(prev => mergePrefs(prev, {
      docPrefs: {
        lastResizeAnchor: resizeForm.anchor,
      },
    }));
    triggerFeedback("resize-doc", "success");
    flash("Canvas resized", "success", 1200);
  }, [
    activeId,
    docH,
    docRef,
    docW,
    fitViewTo,
    flash,
    resizeForm,
    selectedShape,
    setDocH,
    setDocW,
    setModal,
    triggerFeedback,
    updatePrefs,
    withFullHistory,
  ]);

  const applyNewDocument = useCallback(() => {
    const width = clamp(Math.round(+docForm.width || DEFAULT_W), 64, 8192);
    const height = clamp(Math.round(+docForm.height || DEFAULT_H), 64, 8192);
    const rawBackground = (docForm.background || "").trim();
    const backgroundHex = rawBackground.startsWith("#") ? rawBackground : `#${rawBackground}`;
    if (!HEX_COLOR_RE.test(backgroundHex)) {
      triggerFieldFeedback("doc-background", "error");
      triggerFeedback("new-doc", "error");
      flash("Use a valid background hex color.", "error");
      return;
    }
    const background = normalizeHexColor(docForm.background, DEFAULT_BG);
    withFullHistory(() => {
      const next = createDefaultDocument(width, height, background);
      docRef.current = next.doc;
      renderCacheRef.current = {};
      setDocW(width);
      setDocH(height);
      setActiveId(next.activeId);
      setSelectedShape(null);
      setModal(null);
      setTool(preferredRasterTool);
      setSaveHandle(null);
      setStarterDismissed(false);
      requestAnimationFrame(() => fitViewTo(width, height));
      return { docW: width, docH: height, activeId: next.activeId, selectedShape: null };
    });
    updatePrefs(prev => mergePrefs(prev, {
      docPrefs: {
        lastNewDoc: { width, height, background },
        recentDocPresets: pushRecentPreset(
          prev.docPrefs.recentDocPresets,
          { width, height, background },
          RECENT_PRESETS_LIMIT,
        ),
      },
    }));
    if (isCompactUI) setMobilePanelTab("next");
    triggerFeedback("new-doc", "success");
    flash("New document ready", "success");
  }, [
    docForm,
    docRef,
    fitViewTo,
    flash,
    isCompactUI,
    preferredRasterTool,
    renderCacheRef,
    setActiveId,
    setDocH,
    setDocW,
    setMobilePanelTab,
    setModal,
    setSaveHandle,
    setSelectedShape,
    setStarterDismissed,
    setTool,
    triggerFeedback,
    triggerFieldFeedback,
    updatePrefs,
    withFullHistory,
  ]);

  const recoverDraftProject = useCallback(() => {
    if (!recoveryDraft?.project) return;
    hydrateDraftPayload(recoveryDraft.project)
      .then(project => {
        applyProjectState(project, { dirty: true, savedAt: recoveryDraft.savedAt || null });
        clearRecoveryDraft();
        triggerFeedback("recover", "success");
        flash("Recovered autosaved draft", "success");
      })
      .catch(() => {
        clearRecoveryDraft();
        triggerFeedback("recover", "error");
        flash("Draft recovery failed", "error");
      });
  }, [applyProjectState, clearRecoveryDraft, flash, recoveryDraft, triggerFeedback]);

  const discardRecoveredDraft = useCallback(() => {
    clearRecoveryDraft();
  }, [clearRecoveryDraft]);

  const handleExport = useCallback((options = {}) => {
    const scale = Math.max(0.1, Number(options.scale) || 1);
    const region = options.region || { x: 0, y: 0, w: docW, h: docH };
    const exportCanvas = makeCanvas(Math.max(1, Math.round(region.w * scale)), Math.max(1, Math.round(region.h * scale)));
    const ctx = exportCanvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.translate(-region.x, -region.y);
    if (options.includeBackground !== false) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(region.x, region.y, region.w, region.h);
    }
    const editorDoc = docRef.current;
    for (const id of editorDoc.order) {
      const layer = editorDoc.layers[id];
      if (!layer?.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blend;
      ctx.translate(layer.ox, layer.oy);
      if (layer.type === "raster") ctx.drawImage(layer.canvas, 0, 0);
      else if (layer.type === "text") drawText(ctx, layer);
      else layer.shapes.forEach(shape => drawShape(ctx, shape));
      ctx.restore();
    }
    const format = options.format || "png";
    const mime = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const anchor = document.createElement("a");
    const finish = (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      anchor.href = url;
      anchor.download = `${options.filename || "pixelforge-export"}.${format}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };
    exportCanvas.toBlob(finish, mime, options.quality ?? 0.92);
    triggerFeedback("export", "success");
    flash(`Exported ${format.toUpperCase()}`, "success");
  }, [docH, docRef, docW, flash, triggerFeedback]);

  const canUseFileSave = supportsFileSave();
  const saveButtonLabel = canUseFileSave ? "Save" : "Download";
  const saveButtonTitle = canUseFileSave ? "Save project" : "Download project file";

  return {
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
  };
}
