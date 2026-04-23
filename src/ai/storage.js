const NAMESPACE = "PixelForge.ai.v1";

function readRaw() {
  try {
    const raw = window.localStorage.getItem(NAMESPACE);
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
    window.localStorage.setItem(NAMESPACE, JSON.stringify(next));
  } catch {
    // Storage failures are non-fatal
  }
  return next;
}

export function clearApiConfig() {
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
