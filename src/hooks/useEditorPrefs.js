import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PREFS, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_W, DEFAULT_H, DEFAULT_BG,
  PREFS_KEY, RECENT_COLORS_LIMIT, RECENT_SIZES_LIMIT,
} from "../constants.js";
import { mergePrefs, pushRecentValue } from "../utils.js";

function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { prefs: DEFAULT_PREFS, loadedFromStorage: false };
    return { prefs: mergePrefs(DEFAULT_PREFS, JSON.parse(raw)), loadedFromStorage: true };
  } catch {
    window.localStorage.removeItem(PREFS_KEY);
    return { prefs: DEFAULT_PREFS, loadedFromStorage: false };
  }
}

function persistPrefs(prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures; local preferences are optional.
  }
}

export default function useEditorPrefs({
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
}) {
  const [{ prefs, loadedFromStorage }, setPrefsState] = useState(loadPrefs);
  const hydratedRef = useRef(false);
  const latestPrefsRef = useRef(prefs);
  const loadedFromStorageRef = useRef(loadedFromStorage);
  const setPrefs = useCallback((updater) => {
    setPrefsState((state) => {
      const nextPrefs = typeof updater === "function" ? updater(state.prefs) : updater;
      return { ...state, prefs: nextPrefs };
    });
  }, []);

  const updatePrefs = useCallback((updater) => {
    setPrefs(prev => {
      const next = updater(prev);
      latestPrefsRef.current = next;
      return next;
    });
  }, [setPrefs]);

  // Hydrate editor state from stored prefs on mount
  useEffect(() => {
    const p = latestPrefsRef.current;
    setBrushSize(p.toolPrefs.brushSize || 10);
    setBrushOpacity(p.toolPrefs.brushOpacity ?? 1);
    setStrokeW(p.toolPrefs.strokeWidth || 2);
    setFillOn(p.toolPrefs.fillOn ?? true);
    setStrokeOn(p.toolPrefs.strokeOn ?? true);
    setColor1(p.toolPrefs.recentColors?.[0] || DEFAULT_PRIMARY);
    setColor2(p.toolPrefs.recentColors?.[1] || DEFAULT_SECONDARY);
    setDocForm(p.docPrefs.lastNewDoc || { width: DEFAULT_W, height: DEFAULT_H, background: DEFAULT_BG });
    setResizeForm(prev => ({
      ...prev,
      anchor: p.docPrefs.lastResizeAnchor || "center",
    }));
    setMobilePanelTab(p.uiPrefs.mobileTab || "next");
    hydratedRef.current = true;
  }, [
    setBrushOpacity,
    setBrushSize,
    setColor1,
    setColor2,
    setDocForm,
    setFillOn,
    setMobilePanelTab,
    setResizeForm,
    setStrokeOn,
    setStrokeW,
  ]);

  // Persist prefs state to localStorage whenever it changes
  useEffect(() => {
    if (!hydratedRef.current) return;
    persistPrefs(prefs);
  }, [prefs]);

  // Sync editor values back to prefs — derived computation, not setState in effect.
  // Uses a ref to track previous values and only calls updatePrefs when needed.
  // On the first run after hydration, seed prevSyncRef from the *loaded* prefs
  // rather than the incoming props so that the parent's pre-hydration values
  // don't immediately clobber what we just loaded from storage.
  const prevSyncRef = useRef(null);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (prevSyncRef.current === null) {
      // If prefs came from storage, seed from loaded values and skip this run
      // so the parent has a chance to reconcile its state via the setters we
      // just invoked. If no stored prefs, treat incoming props as truth and
      // persist them immediately.
      if (loadedFromStorageRef.current) {
        const loaded = latestPrefsRef.current;
        const loadedBrushSize = loaded.toolPrefs.brushSize ?? brushSize;
        prevSyncRef.current = {
          brushSize: loadedBrushSize,
          brushOpacity: loaded.toolPrefs.brushOpacity ?? brushOpacity,
          strokeW: loaded.toolPrefs.strokeWidth ?? strokeW,
          fillOn: loaded.toolPrefs.fillOn ?? fillOn,
          strokeOn: loaded.toolPrefs.strokeOn ?? strokeOn,
          color1: loaded.toolPrefs.recentColors?.[0] ?? color1,
          color2: loaded.toolPrefs.recentColors?.[1] ?? color2,
          tool,
          mobilePanelTab: loaded.uiPrefs.mobileTab ?? mobilePanelTab,
          brushSizeTool: loadedBrushSize,
        };
        return;
      }
      prevSyncRef.current = {};
    }
    const prev = prevSyncRef.current;
    const changed =
      prev.brushSize !== brushSize ||
      prev.brushOpacity !== brushOpacity ||
      prev.strokeW !== strokeW ||
      prev.fillOn !== fillOn ||
      prev.strokeOn !== strokeOn ||
      prev.color1 !== color1 ||
      prev.color2 !== color2 ||
      prev.tool !== tool ||
      prev.brushSizeTool !== (["brush", "eraser"].includes(tool) ? brushSize : prev.brushSizeTool) ||
      prev.mobilePanelTab !== mobilePanelTab;

    if (!changed) return;

    prevSyncRef.current = { brushSize, brushOpacity, strokeW, fillOn, strokeOn, color1, color2, tool, mobilePanelTab, brushSizeTool: brushSize };

    updatePrefs(current => {
      let next = current;
      // Tool prefs
      if (
        current.toolPrefs.brushSize !== brushSize ||
        current.toolPrefs.brushOpacity !== brushOpacity ||
        current.toolPrefs.strokeWidth !== strokeW ||
        current.toolPrefs.fillOn !== fillOn ||
        current.toolPrefs.strokeOn !== strokeOn
      ) {
        next = mergePrefs(next, {
          toolPrefs: { brushSize, brushOpacity, strokeWidth: strokeW, fillOn, strokeOn },
        });
      }
      // Recent colors
      const nextRecentColors = pushRecentValue(
        pushRecentValue(current.toolPrefs.recentColors, color1, RECENT_COLORS_LIMIT),
        color2,
        RECENT_COLORS_LIMIT,
      );
      if (JSON.stringify(current.toolPrefs.recentColors) !== JSON.stringify(nextRecentColors)) {
        next = mergePrefs(next, { toolPrefs: { recentColors: nextRecentColors } });
      }
      // Recent brush sizes (only when brush/eraser active)
      if (["brush", "eraser"].includes(tool)) {
        const nextRecentSizes = pushRecentValue(current.toolPrefs.recentBrushSizes, brushSize, RECENT_SIZES_LIMIT);
        if (JSON.stringify(current.toolPrefs.recentBrushSizes) !== JSON.stringify(nextRecentSizes)) {
          next = mergePrefs(next, { toolPrefs: { recentBrushSizes: nextRecentSizes } });
        }
      }
      // Mobile tab
      if (current.uiPrefs.mobileTab !== mobilePanelTab) {
        next = mergePrefs(next, { uiPrefs: { mobileTab: mobilePanelTab } });
      }
      return next;
    });
  }, [brushOpacity, brushSize, color1, color2, fillOn, mobilePanelTab, strokeOn, strokeW, tool, updatePrefs]);

  return {
    prefs,
    updatePrefs,
  };
}
