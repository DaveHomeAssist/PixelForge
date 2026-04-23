import { TOOLS, HEX_COLOR_RE } from "./constants.js";

let _n = 0;
export const uid = () => `${++_n}_${(Date.now() + Math.random()).toString(36)}`;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rgbHex = (r, g, b) => "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");

export function normalizeHexColor(value, fallback) {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  if (!HEX_COLOR_RE.test(hex)) return fallback;
  if (hex.length === 4) return "#" + hex.slice(1).split("").map(char => char + char).join("").toLowerCase();
  return hex.toLowerCase();
}

export function isEditableTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

export function ensureShape(shape) {
  return { ...shape, id: shape.id || uid() };
}

export function cloneShape(shape) {
  return structuredClone(ensureShape(shape));
}

export function cloneShapes(shapes) {
  return (shapes || []).map(cloneShape);
}

export function mergePrefs(base, partial) {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) return base;
  const next = { ...base };
  Object.keys(partial).forEach(key => {
    const baseValue = base[key];
    const partialValue = partial[key];
    if (baseValue && partialValue && typeof baseValue === "object" && typeof partialValue === "object" && !Array.isArray(baseValue) && !Array.isArray(partialValue)) {
      next[key] = mergePrefs(baseValue, partialValue);
      return;
    }
    next[key] = partialValue;
  });
  return next;
}

export function pushRecentValue(list, value, limit = 6) {
  const next = [value, ...(list || []).filter(item => item !== value)];
  return next.slice(0, limit);
}

export function pushRecentPreset(list, preset, limit = 4) {
  const key = `${preset.width}x${preset.height}:${preset.background}`;
  const next = [preset, ...(list || []).filter(item => `${item.width}x${item.height}:${item.background}` !== key)];
  return next.slice(0, limit);
}

export function getToolRequirement(toolId) {
  const meta = TOOLS.find(item => item.id === toolId);
  if (!meta) return null;
  if (meta.raster && !meta.vector && !meta.text) return "raster";
  if (meta.vector && !meta.raster && !meta.text) return "vector";
  if (meta.text && !meta.raster && !meta.vector) return "text";
  return null;
}

export function extractRegion(fullImageData, region) {
  const { x, y, w, h } = region;
  const fullW = fullImageData.width;
  const regionData = new ImageData(w, h);
  const src = fullImageData.data;
  const dst = regionData.data;
  for (let row = 0; row < h; row++) {
    const srcOffset = ((y + row) * fullW + x) * 4;
    const dstOffset = row * w * 4;
    dst.set(src.subarray(srcOffset, srcOffset + w * 4), dstOffset);
  }
  return regionData;
}

export function getAnchorOffset(anchor, oldW, oldH, newW, newH) {
  const dxMap = { nw: 0, n: (newW - oldW) / 2, ne: newW - oldW, w: 0, center: (newW - oldW) / 2, e: newW - oldW, sw: 0, s: (newW - oldW) / 2, se: newW - oldW };
  const dyMap = { nw: 0, n: 0, ne: 0, w: (newH - oldH) / 2, center: (newH - oldH) / 2, e: (newH - oldH) / 2, sw: newH - oldH, s: newH - oldH, se: newH - oldH };
  return { dx: dxMap[anchor] || 0, dy: dyMap[anchor] || 0 };
}

export function reorderList(list, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return [...list];
  const sourceIndex = list.indexOf(sourceId);
  const targetIndex = list.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return [...list];
  const next = [...list];
  next.splice(sourceIndex, 1);
  const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  next.splice(insertAt, 0, sourceId);
  return next;
}
