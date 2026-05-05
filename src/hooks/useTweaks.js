import { useState, useEffect, useCallback } from "react";

/**
 * useTweaks
 *
 * PR 2 of the redesign cycle (2026-05-04). Single source of truth for the 8
 * cosmetic axes the redesign exposes via the TweaksPanel. State persists to
 * localStorage under STORAGE_KEY and applies the matching data-* attributes
 * plus CSS custom properties on document.documentElement.
 *
 * Defaults are locked per plan section 9:
 *   - density: 1
 *   - radius:  8 (NOT the design's 10; preserves existing visual mass)
 *   - theme:   "light" (flipped from design's dark default for continuity with legacy users; users can flip via TweaksPanel)
 *   - accent:  "amber"
 *   - type:    "geist"
 *
 * No new useEffectEvent usage per Q9. Plain useEffect + useCallback.
 */

const STORAGE_KEY = "pf:tweaks:v1";

const TWEAK_DEFAULTS = {
  theme: "light",
  accent: "amber",
  type: "geist",
  density: 1,
  radius: 8,
  toolbar: "grouped",
  panel: "stacked",
  starter: "card",
};

function loadInitial() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return TWEAK_DEFAULTS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return TWEAK_DEFAULTS;
    return { ...TWEAK_DEFAULTS, ...parsed };
  } catch {
    return TWEAK_DEFAULTS;
  }
}

export default function useTweaks() {
  const [tweaks, setTweaks] = useState(loadInitial);

  // Persist on every change. Catch the quota / private-mode error so the app
  // continues to run even when localStorage is unavailable.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      /* localStorage unavailable; continue with in-memory state. */
    }
  }, [tweaks]);

  // Apply data-* attributes and CSS custom properties to the document root.
  // Runs on mount and on any tweak change so the visible UI tracks state.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", tweaks.theme);
    root.setAttribute("data-accent", tweaks.accent);
    root.setAttribute("data-type", tweaks.type);
    root.style.setProperty("--pf-density", String(tweaks.density));
    root.style.setProperty("--pf-radius", `${tweaks.radius}px`);
    root.style.setProperty("--pf-radius-sm", `${Math.max(2, tweaks.radius - 4)}px`);
    root.style.setProperty("--pf-radius-lg", `${tweaks.radius + 4}px`);
  }, [tweaks]);

  const setTweak = useCallback((key, value) => {
    setTweaks((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetTweaks = useCallback(() => {
    setTweaks(TWEAK_DEFAULTS);
  }, []);

  return [tweaks, setTweak, resetTweaks];
}

export { TWEAK_DEFAULTS, STORAGE_KEY };
