const NAMESPACE = "PixelForge.ai.v1";

// Keys are kept in sessionStorage on purpose. GitHub Pages serves every
// project on an account from the same origin (only the path differs), and
// localStorage is origin-wide — a long-lived key stored there is readable by
// JavaScript deployed under any sibling project path. Session storage is
// per-tab and cleared when the tab closes, which keeps the exposure window
// small. Any legacy localStorage copy is migrated out on first read.
function migrateLegacyLocalStorage() {
  try {
    const legacy = window.localStorage.getItem(NAMESPACE);
    if (legacy == null) return;
    window.localStorage.removeItem(NAMESPACE);
    if (!window.sessionStorage.getItem(NAMESPACE)) {
      window.sessionStorage.setItem(NAMESPACE, legacy);
    }
  } catch {
    // Storage failures are non-fatal
  }
}

function readRaw() {
  try {
    migrateLegacyLocalStorage();
    const raw = window.sessionStorage.getItem(NAMESPACE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getApiConfig() {
  return readRaw();
}

export function setApiConfig(partial) {
  const next = { ...readRaw(), ...partial };
  try {
    window.sessionStorage.setItem(NAMESPACE, JSON.stringify(next));
  } catch {
    // Storage failures are non-fatal
  }
  return next;
}

export function clearApiConfig() {
  try {
    window.sessionStorage.removeItem(NAMESPACE);
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(NAMESPACE);
  } catch {
    // ignore
  }
}

export function hasAnthropicKey() {
  return !!readRaw().anthropicKey;
}

export function hasProviderKey() {
  return !!readRaw().providerKey;
}
