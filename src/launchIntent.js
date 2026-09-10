import { DEFAULT_W, DEFAULT_H, DEFAULT_BG } from "./constants.js";
import { clamp } from "./utils.js";

// Launch intent is the handoff contract between the launcher pages (home,
// templates) and the editor. The launcher writes it, the editor consumes it
// exactly once on mount and opens a document that honors it. sessionStorage
// keeps the intent scoped to the tab that created it.
export const LAUNCH_INTENT_KEY = "PixelForge.launchDraft.v1";
export const MIN_LAUNCH_DIM = 64;
export const MAX_LAUNCH_DIM = 8192;

// Backgrounds the document model can honor today. createDefaultDocument fills
// the background layer with one solid color, so only solid fills map. Any
// other launcher choice is reported back to the caller as unsupported instead
// of being silently replaced.
export const LAUNCH_BACKGROUNDS = {
  white: DEFAULT_BG,
};

function toLaunchDim(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return clamp(n, MIN_LAUNCH_DIM, MAX_LAUNCH_DIM);
}

export function normalizeLaunchIntent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const requestedBackground = typeof raw.background === "string" ? raw.background.trim().toLowerCase() : "";
  const background = LAUNCH_BACKGROUNDS[requestedBackground] || null;
  return {
    preset: typeof raw.preset === "string" ? raw.preset : null,
    width: toLaunchDim(raw.width, DEFAULT_W),
    height: toLaunchDim(raw.height, DEFAULT_H),
    background,
    requestedBackground: requestedBackground || null,
    backgroundSupported: !requestedBackground || !!background,
  };
}

export function writeLaunchIntent(draft) {
  try {
    window.sessionStorage.setItem(LAUNCH_INTENT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    // Storage may be disabled; the editor still opens with defaults.
    return false;
  }
}

function takeStoredIntent() {
  try {
    const raw = window.sessionStorage.getItem(LAUNCH_INTENT_KEY);
    if (raw != null) window.sessionStorage.removeItem(LAUNCH_INTENT_KEY);
    return raw;
  } catch {
    return null;
  }
}

export function consumeLaunchIntent() {
  const raw = takeStoredIntent();
  if (raw == null) return null;
  try {
    return normalizeLaunchIntent(JSON.parse(raw));
  } catch {
    return null;
  }
}
