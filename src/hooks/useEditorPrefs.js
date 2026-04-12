import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PREFS, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_W, DEFAULT_H, DEFAULT_BG,
  PREFS_KEY, RECENT_COLORS_LIMIT, RECENT_SIZES_LIMIT,
} from "../constants.js";
import { mergePrefs, pushRecentValue } from "../utils.js";

function loadPrefs() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? mergePrefs(DEFAULT_PREFS, JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    window.localStorage.removeItem(PREFS_KEY);
    return DEFAULT_PREFS;
  }
}

function sameList(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
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
  const [prefs, setPrefs] = useState(loadPrefs);
  const initialPrefsRef = useRef(prefs);
  const hydratedRef = useRef(false);

  const updatePrefs = useCallback((updater) => {
    setPrefs(prev => updater(prev));
  }, []);

  useEffect(() => {
    const initialPrefs = initialPrefsRef.current;
    setBrushSize(initialPrefs.toolPrefs.brushSize || 10);
    setBrushOpacity(initialPrefs.toolPrefs.brushOpacity ?? 1);
    setStrokeW(initialPrefs.toolPrefs.strokeWidth || 2);
    setFillOn(initialPrefs.toolPrefs.fillOn ?? true);
    setStrokeOn(initialPrefs.toolPrefs.strokeOn ?? true);
    setColor1(initialPrefs.toolPrefs.recentColors?.[0] || DEFAULT_PRIMARY);
    setColor2(initialPrefs.toolPrefs.recentColors?.[1] || DEFAULT_SECONDARY);
    setDocForm(initialPrefs.docPrefs.lastNewDoc || { width: DEFAULT_W, height: DEFAULT_H, background: DEFAULT_BG });
    setResizeForm(prev => ({
      ...prev,
      anchor: initialPrefs.docPrefs.lastResizeAnchor || "center",
    }));
    setMobilePanelTab(initialPrefs.uiPrefs.mobileTab || "next");
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

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage failures; local preferences are optional.
    }
  }, [prefs]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setPrefs(prev => {
      const toolPrefs = prev.toolPrefs;
      if (
        toolPrefs.brushSize === brushSize &&
        toolPrefs.brushOpacity === brushOpacity &&
        toolPrefs.strokeWidth === strokeW &&
        toolPrefs.fillOn === fillOn &&
        toolPrefs.strokeOn === strokeOn
      ) {
        return prev;
      }
      return mergePrefs(prev, {
        toolPrefs: {
          brushSize,
          brushOpacity,
          strokeWidth: strokeW,
          fillOn,
          strokeOn,
        },
      });
    });
  }, [brushOpacity, brushSize, fillOn, strokeOn, strokeW]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setPrefs(prev => {
      const nextRecentColors = pushRecentValue(
        pushRecentValue(prev.toolPrefs.recentColors, color1, RECENT_COLORS_LIMIT),
        color2,
        RECENT_COLORS_LIMIT,
      );
      if (sameList(prev.toolPrefs.recentColors, nextRecentColors)) return prev;
      return mergePrefs(prev, {
        toolPrefs: {
          recentColors: nextRecentColors,
        },
      });
    });
  }, [color1, color2]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!["brush", "eraser"].includes(tool)) return;
    setPrefs(prev => {
      const nextRecentSizes = pushRecentValue(prev.toolPrefs.recentBrushSizes, brushSize, RECENT_SIZES_LIMIT);
      if (sameList(prev.toolPrefs.recentBrushSizes, nextRecentSizes)) return prev;
      return mergePrefs(prev, {
        toolPrefs: {
          recentBrushSizes: nextRecentSizes,
        },
      });
    });
  }, [brushSize, tool]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setPrefs(prev => (
      prev.uiPrefs.mobileTab === mobilePanelTab
        ? prev
        : mergePrefs(prev, {
          uiPrefs: { mobileTab: mobilePanelTab },
        })
    ));
  }, [mobilePanelTab]);

  return {
    prefs,
    updatePrefs,
  };
}
