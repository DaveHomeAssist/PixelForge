import { useState, useRef, useEffect, useCallback } from "react";
import { mergePrefs, getToolRequirement } from "../utils.js";

/**
 * useToolSelection
 *
 * Encapsulates tool switching, layer auto-focus and "intent" pulse feedback.
 * Extracted from PixelForge.jsx (Phase 4A). Pure refactor — behavior should
 * match the previous inlined implementation exactly.
 */
export default function useToolSelection({
  layers,
  activeId,
  isCompactUI,
  prefs,
  setActiveId,
  setTool,
  setMobilePanelTab,
  updatePrefs,
  triggerFeedback,
}) {
  const [intentLayerId, setIntentLayerId] = useState(null);
  const [intentLayerTone, setIntentLayerTone] = useState("suggested");
  const [lastLayerByType, setLastLayerByType] = useState({ raster: null, vector: null });
  const intentLayerTimer = useRef(null);

  // Cleanup pending pulse timer on unmount.
  useEffect(() => () => window.clearTimeout(intentLayerTimer.current), []);

  // Track the most recent active layer per type so we can auto-focus the
  // "likely" layer when the user switches tools.
  useEffect(() => {
    const current = layers.find(l => l.id === activeId);
    if (!current?.type) return;
    // Preserving previous behavior from PixelForge.jsx — we only write when the
    // id actually changes, which is a no-op for unrelated renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastLayerByType(prev => prev[current.type] === current.id ? prev : { ...prev, [current.type]: current.id });
  }, [activeId, layers]);

  const pulseLayer = useCallback((id, tone = "suggested", ms = 180) => {
    if (!id) return;
    if (tone === "suggested" && !prefs.behaviorPrefs.highlightLikelyLayer) return;
    setIntentLayerId(id);
    setIntentLayerTone(tone);
    window.clearTimeout(intentLayerTimer.current);
    intentLayerTimer.current = window.setTimeout(() => {
      setIntentLayerId(null);
      setIntentLayerTone("suggested");
    }, ms);
  }, [prefs.behaviorPrefs.highlightLikelyLayer]);

  const pickLikelyLayerId = useCallback((type, { includeLocked = false } = {}) => {
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
    if (!ordered.length && !includeLocked) {
      // Retry including locked layers.
      const fallbackSeen = new Set();
      const fallbackOrdered = [];
      const fallbackPush = (id) => {
        if (!id || fallbackSeen.has(id)) return;
        const layer = layers.find(l => l.id === id);
        if (!layer || layer.type !== type) return;
        fallbackSeen.add(id);
        fallbackOrdered.push(id);
      };
      fallbackPush(lastLayerByType[type]);
      fallbackPush(activeId);
      [...layers].reverse().forEach(l => fallbackPush(l.id));
      return fallbackOrdered[0] || null;
    }
    return ordered[0] || null;
  }, [activeId, lastLayerByType, layers]);

  const focusLayerId = useCallback((id, { pulse = true } = {}) => {
    if (!id || !layers.some(l => l.id === id)) return null;
    setActiveId(id);
    if (pulse) pulseLayer(id, "suggested");
    return id;
  }, [layers, pulseLayer, setActiveId]);

  const focusLayerType = useCallback((type, options = {}) => {
    const id = pickLikelyLayerId(type);
    if (!id) return null;
    return focusLayerId(id, options);
  }, [focusLayerId, pickLikelyLayerId]);

  const selectTool = useCallback((nextTool) => {
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
  }, [activeId, focusLayerType, isCompactUI, layers, prefs.behaviorPrefs.autoSwitchLayerForTool, setTool, setMobilePanelTab, triggerFeedback, updatePrefs]);

  return {
    selectTool,
    focusLayerId,
    focusLayerType,
    pickLikelyLayerId,
    pulseLayer,
    intentLayerId,
    intentLayerTone,
    lastLayerByType,
  };
}
