import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PREFS, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_W, DEFAULT_H, DEFAULT_BG,
  PREFS_KEY, RECENT_COLORS_LIMIT, RECENT_SIZES_LIMIT,
} from "../constants.js";
import { mergePrefs, pushRecentValue } from "../utils.js";

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
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);

  const updatePrefs = useCallback((updater) => {
    setPrefs(prev => updater(prev));
  }, []);

  useEffect(() => {
    let nextPrefs = DEFAULT_PREFS;
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) nextPrefs = mergePrefs(DEFAULT_PREFS, JSON.parse(raw));
    } catch {
      window.localStorage.removeItem(PREFS_KEY);
    }

    setPrefs(nextPrefs);
    setBrushSize(nextPrefs.toolPrefs.brushSize || 10);
    setBrushOpacity(nextPrefs.toolPrefs.brushOpacity ?? 1);
    setStrokeW(nextPrefs.toolPrefs.strokeWidth || 2);
    setFillOn(nextPrefs.toolPrefs.fillOn ?? true);
    setStrokeOn(nextPrefs.toolPrefs.strokeOn ?? true);
    setColor1(nextPrefs.toolPrefs.recentColors?.[0] || DEFAULT_PRIMARY);
    setColor2(nextPrefs.toolPrefs.recentColors?.[1] || DEFAULT_SECONDARY);
    setDocForm(nextPrefs.docPrefs.lastNewDoc || { width: DEFAULT_W, height: DEFAULT_H, background: DEFAULT_BG });
    setResizeForm(prev => ({
      ...prev,
      anchor: nextPrefs.docPrefs.lastResizeAnchor || "center",
    }));
    setMobilePanelTab(nextPrefs.uiPrefs.mobileTab || "next");
    setPrefsReady(true);
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

  useEffect(() => {
    if (!prefsReady) return;
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage failures; local preferences are optional.
    }
  }, [prefs, prefsReady]);

  useEffect(() => {
    if (!prefsReady) return;
    updatePrefs(prev => mergePrefs(prev, {
      toolPrefs: {
        brushSize,
        brushOpacity,
        strokeWidth: strokeW,
        fillOn,
        strokeOn,
      },
    }));
  }, [brushOpacity, brushSize, fillOn, prefsReady, strokeOn, strokeW, updatePrefs]);

  useEffect(() => {
    if (!prefsReady) return;
    updatePrefs(prev => mergePrefs(prev, {
      toolPrefs: {
        recentColors: pushRecentValue(pushRecentValue(prev.toolPrefs.recentColors, color1, RECENT_COLORS_LIMIT), color2, RECENT_COLORS_LIMIT),
      },
    }));
  }, [color1, color2, prefsReady, updatePrefs]);

  useEffect(() => {
    if (!prefsReady) return;
    if (!["brush", "eraser"].includes(tool)) return;
    updatePrefs(prev => mergePrefs(prev, {
      toolPrefs: {
        recentBrushSizes: pushRecentValue(prev.toolPrefs.recentBrushSizes, brushSize, RECENT_SIZES_LIMIT),
      },
    }));
  }, [brushSize, prefsReady, tool, updatePrefs]);

  useEffect(() => {
    if (!prefsReady) return;
    updatePrefs(prev => mergePrefs(prev, {
      uiPrefs: { mobileTab: mobilePanelTab },
    }));
  }, [mobilePanelTab, prefsReady, updatePrefs]);

  return {
    prefs,
    updatePrefs,
  };
}
