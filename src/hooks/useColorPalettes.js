import { useCallback, useState } from "react";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "../constants.js";
import { formatHex, parseHex } from "../colorOps.js";

export const PALETTES_KEY = "pf:palettes:v1";

function normalizeColor(color) {
  const parsed = parseHex(color);
  return parsed ? formatHex(parsed) : null;
}

function normalizeState(value, prefs) {
  const migratedRecents = prefs?.uiPrefs?.recents || prefs?.toolPrefs?.recentColors || [DEFAULT_PRIMARY, DEFAULT_SECONDARY];
  const state = value && typeof value === "object" ? value : {};
  return {
    palettes: Array.isArray(state.palettes)
      ? state.palettes.map(palette => ({
        id: String(palette.id),
        name: String(palette.name || "Palette"),
        builtin: !!palette.builtin,
        colors: Array.isArray(palette.colors) ? palette.colors.map(normalizeColor).filter(Boolean) : [],
      }))
      : [],
    recents: Array.isArray(state.recents)
      ? state.recents.map(normalizeColor).filter(Boolean).slice(0, 16)
      : migratedRecents.map(normalizeColor).filter(Boolean).slice(0, 16),
  };
}

function loadState(prefs) {
  try {
    const raw = window.localStorage.getItem(PALETTES_KEY);
    if (raw) return normalizeState(JSON.parse(raw), prefs);
    const migrated = normalizeState(null, prefs);
    persistState(migrated);
    return migrated;
  } catch {
    window.localStorage.removeItem(PALETTES_KEY);
    return normalizeState(null, prefs);
  }
}

function persistState(state) {
  try {
    window.localStorage.setItem(PALETTES_KEY, JSON.stringify(state));
  } catch {
    // Palette persistence is optional.
  }
}

function makePaletteId() {
  return `palette-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function useColorPalettes(prefs) {
  const [state, setState] = useState(() => loadState(prefs));

  const update = useCallback((updater) => {
    setState(prev => {
      const next = normalizeState(typeof updater === "function" ? updater(prev) : updater, prefs);
      persistState(next);
      return next;
    });
  }, [prefs]);

  const addRecent = useCallback((color) => {
    const normalized = normalizeColor(color);
    if (!normalized) return;
    update(prev => ({
      ...prev,
      recents: [normalized, ...prev.recents.filter(entry => entry !== normalized)].slice(0, 16),
    }));
  }, [update]);

  const savePalette = useCallback((name, colors) => {
    const nextColors = (colors || []).map(normalizeColor).filter(Boolean);
    if (!nextColors.length) return null;
    const palette = {
      id: makePaletteId(),
      name: String(name || "Custom Palette").trim() || "Custom Palette",
      colors: nextColors,
    };
    update(prev => ({ ...prev, palettes: [...prev.palettes, palette] }));
    return palette.id;
  }, [update]);

  const renamePalette = useCallback((id, name) => {
    update(prev => ({
      ...prev,
      palettes: prev.palettes.map(palette => (
        palette.id === id ? { ...palette, name: String(name || palette.name).trim() || palette.name } : palette
      )),
    }));
  }, [update]);

  const deletePalette = useCallback((id) => {
    update(prev => ({
      ...prev,
      palettes: prev.palettes.filter(palette => palette.id !== id || palette.builtin),
    }));
  }, [update]);

  return {
    palettes: state.palettes,
    recents: state.recents,
    addRecent,
    savePalette,
    renamePalette,
    deletePalette,
  };
}
