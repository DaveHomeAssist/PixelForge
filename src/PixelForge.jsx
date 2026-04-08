import { useState, useRef, useEffect, useCallback } from "react";
import {
  MousePointer2, Pencil, Eraser, Square, Circle, Minus, Pipette,
  Eye, EyeOff, Plus, Trash2, Undo2, Redo2, Save, FolderOpen,
  Download, ZoomIn, ZoomOut, ChevronUp, ChevronDown, Maximize2, Image
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   CONSTANTS & CONFIG
   ═══════════════════════════════════════════════════ */

const DEFAULT_W = 1200, DEFAULT_H = 800;
const MIN_ZOOM = 0.02, MAX_ZOOM = 64;
const CHECKER = 10;
const DEFAULT_PRIMARY = "#2a6f97";
const DEFAULT_SECONDARY = "#16324f";

const TOOLS = [
  { id: "move", label: "Move", icon: MousePointer2, shortcut: "V", raster: true, vector: true },
  { id: "brush", label: "Brush", icon: Pencil, shortcut: "B", raster: true, vector: false },
  { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "E", raster: true, vector: false },
  { id: "rect", label: "Rectangle", icon: Square, shortcut: "R", raster: false, vector: true },
  { id: "ellipse", label: "Ellipse", icon: Circle, shortcut: "O", raster: false, vector: true },
  { id: "line", label: "Line", icon: Minus, shortcut: "L", raster: false, vector: true },
  { id: "eyedropper", label: "Eyedropper", icon: Pipette, shortcut: "I", raster: true, vector: true },
];

const BLENDS = [
  "source-over", "multiply", "screen", "overlay", "darken",
  "lighten", "color-dodge", "color-burn", "hard-light",
  "soft-light", "difference", "exclusion",
];

const SWATCHES = [
  "#000000","#ffffff","#d63031","#e17055","#fdcb6e","#00b894",
  "#0984e3","#6c5ce7","#fd79a8","#636e72","#2d3436","#dfe6e9",
  "#fab1a0","#ffeaa7","#55efc4","#74b9ff","#a29bfe","#ff7675",
  "#b2bec3","#81ecec","#f8c291","#e77f67","#cf6a87","#574b90",
];

const TOOL_COPY = {
  move: {
    title: "Move And Arrange",
    description: "Drag entire layers or reposition vector shapes directly on the canvas.",
    hint: "Hold Space while dragging to pan the viewport.",
  },
  brush: {
    title: "Brush",
    description: "Lay down color with a soft round brush for sketching, blocking, and paintover work.",
    hint: "Use [ and ] to resize the brush quickly.",
  },
  eraser: {
    title: "Eraser",
    description: "Remove raster pixels non-destructively from the active raster layer.",
    hint: "Eraser size tracks the same shortcut keys as the brush.",
  },
  rect: {
    title: "Rectangle",
    description: "Build clean blocks and panels with fill and stroke controls.",
    hint: "Primary color fills. Secondary color handles outlines.",
  },
  ellipse: {
    title: "Ellipse",
    description: "Drop circles and ellipses for softer shapes and framing elements.",
    hint: "Combine fill and stroke for quick badge or icon construction.",
  },
  line: {
    title: "Line",
    description: "Create direct vector strokes for guides, dividers, and layout scaffolding.",
    hint: "Secondary stroke width applies to each line segment.",
  },
  eyedropper: {
    title: "Eyedropper",
    description: "Sample any visible color from the composited canvas output.",
    hint: "Click once to replace the primary color with the sampled value.",
  },
};

/* ═══════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════ */

let _n = 0;
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const uid = () => `${++_n}_${(Date.now() + Math.random()).toString(36)}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const lerp = (a, b, t) => a + (b - a) * t;
const rgbHex = (r, g, b) => "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");

function normalizeHexColor(value, fallback) {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  if (!HEX_COLOR_RE.test(hex)) return fallback;
  if (hex.length === 4) return "#" + hex.slice(1).split("").map(char => char + char).join("").toLowerCase();
  return hex.toLowerCase();
}

function isEditableTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function createDefaultDocument(w, h) {
  const bg = {
    id: uid(),
    name: "Background",
    type: "raster",
    visible: true,
    opacity: 1,
    blend: "source-over",
    locked: false,
    canvas: makeCanvas(w, h),
    ox: 0,
    oy: 0,
  };
  const bgCtx = bg.canvas.getContext("2d");
  bgCtx.fillStyle = "#ffffff";
  bgCtx.fillRect(0, 0, w, h);
  const vec = {
    id: uid(),
    name: "Shapes",
    type: "vector",
    visible: true,
    opacity: 1,
    blend: "source-over",
    locked: false,
    shapes: [],
    ox: 0,
    oy: 0,
  };
  return { doc: { layers: { [bg.id]: bg, [vec.id]: vec }, order: [bg.id, vec.id] }, activeId: bg.id };
}

function drawShape(ctx, s) {
  ctx.beginPath();
  if (s.type === "rect") ctx.rect(s.x, s.y, s.w, s.h);
  else if (s.type === "ellipse") {
    const rx = Math.abs(s.w / 2), ry = Math.abs(s.h / 2);
    if (rx > 0 && ry > 0) ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, rx, ry, 0, 0, Math.PI * 2);
  } else if (s.type === "line") { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
  if (s.fill && s.type !== "line") { ctx.fillStyle = s.fill; ctx.fill(); }
  if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.strokeWidth || 2; ctx.lineCap = "round"; ctx.stroke(); }
}

function hitShape(s, px, py) {
  if (s.type === "rect") return px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h;
  if (s.type === "ellipse") {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const rx = Math.abs(s.w / 2), ry = Math.abs(s.h / 2);
    return rx > 0 && ry > 0 && ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2) <= 1;
  }
  if (s.type === "line") {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return dist(px, py, s.x1, s.y1) < 6;
    const t = clamp(((px - s.x1) * dx + (py - s.y1) * dy) / l2, 0, 1);
    return dist(px, py, s.x1 + t * dx, s.y1 + t * dy) < 6;
  }
  return false;
}

/* ═══════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

.pf {
  --pf-bg: #f7f1e7;
  --pf-bg-soft: #fcf8f1;
  --pf-panel: rgba(255, 252, 246, 0.86);
  --pf-panel-strong: rgba(255, 255, 255, 0.95);
  --pf-line: #dfd3c4;
  --pf-line-strong: #ccbda9;
  --pf-text: #25343f;
  --pf-muted: #6c7a84;
  --pf-soft: #95a1a9;
  --pf-accent: #2a6f97;
  --pf-accent-strong: #194d6f;
  --pf-accent-soft: rgba(42, 111, 151, 0.12);
  --pf-highlight: #e8a84f;
  --pf-shadow: 0 18px 50px rgba(96, 70, 34, 0.08);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 32%),
    linear-gradient(180deg, #fcf9f2 0%, #f3ebdf 100%);
  color: var(--pf-text);
  user-select: none;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100vh;
  overflow: hidden;
  position: relative;
}
.pf * { box-sizing: border-box; margin: 0; padding: 0; }
.pf button, .pf input, .pf select { font: inherit; }
.pf button:focus-visible,
.pf input:focus-visible,
.pf select:focus-visible {
  outline: 2px solid rgba(42, 111, 151, 0.38);
  outline-offset: 2px;
}
.pf ::selection { background: rgba(42, 111, 151, 0.14); }
.pf ::-webkit-scrollbar { width: 8px; height: 8px; }
.pf ::-webkit-scrollbar-track { background: rgba(223, 211, 196, 0.45); }
.pf ::-webkit-scrollbar-thumb { background: rgba(165, 150, 130, 0.75); border-radius: 999px; }
.pf ::-webkit-scrollbar-thumb:hover { background: rgba(122, 108, 90, 0.82); }

.pf-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 10px 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(252,248,241,0.88));
  border-bottom: 1px solid var(--pf-line);
  box-shadow: 0 1px 0 rgba(255,255,255,0.7), 0 10px 28px rgba(110, 84, 46, 0.06);
  backdrop-filter: blur(16px);
  flex-shrink: 0;
  z-index: 2;
}
.pf-menu-group,
.pf-menu-r,
.pf-menu-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pf-menu-brand {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--pf-accent-strong);
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(42, 111, 151, 0.08);
  border: 1px solid rgba(42, 111, 151, 0.12);
}
.pf-menu-sep {
  width: 1px;
  align-self: stretch;
  background: linear-gradient(180deg, transparent, var(--pf-line), transparent);
}
.pf-mbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid rgba(201, 188, 169, 0.85);
  background: rgba(255,255,255,0.8);
  color: var(--pf-text);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease, color 0.16s ease;
}
.pf-mbtn:hover {
  color: var(--pf-accent-strong);
  border-color: rgba(42, 111, 151, 0.2);
  background: rgba(255,255,255,0.98);
  box-shadow: 0 8px 20px rgba(128, 96, 52, 0.08);
  transform: translateY(-1px);
}
.pf-mbtn:active {
  transform: translateY(0);
  box-shadow: inset 0 0 0 1px rgba(42, 111, 151, 0.08);
}
.pf-mbtn.primary {
  background: linear-gradient(180deg, rgba(42, 111, 151, 0.16), rgba(42, 111, 151, 0.08));
  border-color: rgba(42, 111, 151, 0.2);
  color: var(--pf-accent-strong);
}
.pf-mbtn.dis {
  opacity: 0.42;
  pointer-events: none;
  box-shadow: none;
}
.pf-zoom {
  min-width: 64px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--pf-muted);
  text-align: center;
  letter-spacing: 0.08em;
}
.pf-menu-meta { margin-left: auto; }
.pf-menu-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(204, 189, 169, 0.8);
  background: rgba(255,255,255,0.62);
  color: var(--pf-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pf-menu-chip.accent {
  color: var(--pf-accent-strong);
  border-color: rgba(42, 111, 151, 0.18);
  background: rgba(42, 111, 151, 0.1);
}

.pf-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }

.pf-toolbar {
  width: 72px;
  padding: 16px 10px;
  background: rgba(255, 251, 246, 0.68);
  border-right: 1px solid var(--pf-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  backdrop-filter: blur(10px);
}
.pf-tbtn {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.74);
  border: 1px solid transparent;
  border-radius: 16px;
  color: var(--pf-muted);
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  position: relative;
  box-shadow: 0 8px 18px rgba(140, 106, 61, 0.05);
}
.pf-tbtn:hover {
  color: var(--pf-text);
  background: rgba(255,255,255,0.96);
  border-color: rgba(201, 188, 169, 0.8);
  transform: translateY(-1px);
}
.pf-tbtn.active {
  color: var(--pf-accent-strong);
  background: linear-gradient(180deg, rgba(42,111,151,0.18), rgba(255,255,255,0.96));
  border-color: rgba(42,111,151,0.2);
  box-shadow: 0 10px 26px rgba(42, 111, 151, 0.14);
}
.pf-tbtn.muted { opacity: 0.52; }
.pf-tbtn .pf-shortcut {
  position: absolute;
  right: 6px;
  bottom: 6px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  color: var(--pf-soft);
}
.pf-toolbar-sep {
  width: 34px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--pf-line), transparent);
  margin: 2px 0;
}
.pf-color-wells {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin-top: 2px;
}
.pf-color-well {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(204, 189, 169, 0.92);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(129, 102, 55, 0.08);
  background: rgba(255,255,255,0.92);
}
.pf-color-well.primary { z-index: 2; }
.pf-color-well.secondary { margin-top: -10px; margin-left: 12px; }
.pf-color-button-label {
  position: absolute;
  top: 6px;
  left: 8px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: rgba(16, 24, 32, 0.68);
  z-index: 2;
}
.pf-color-button-swatch {
  position: absolute;
  inset: 8px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.54);
}
.pf-color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.pf-swap-colors {
  margin-top: 8px;
  width: 34px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(204, 189, 169, 0.8);
  background: rgba(255,255,255,0.85);
  color: var(--pf-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pf-swap-colors:hover {
  color: var(--pf-accent-strong);
  border-color: rgba(42, 111, 151, 0.18);
  background: rgba(255,255,255,0.98);
}

.pf-viewport {
  flex: 1;
  background:
    radial-gradient(circle at top right, rgba(255,255,255,0.62), transparent 26%),
    linear-gradient(180deg, #ece4d8 0%, #e2d8c9 100%);
  overflow: hidden;
  position: relative;
  cursor: crosshair;
  touch-action: none;
}
.pf-viewport::before {
  content: "";
  position: absolute;
  inset: 16px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.34);
  pointer-events: none;
}
.pf-viewport canvas { display: block; position: absolute; top: 0; left: 0; }

.pf-rpanel {
  width: 320px;
  background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(252,248,241,0.92));
  border-left: 1px solid var(--pf-line);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: inset 1px 0 0 rgba(255,255,255,0.55);
}
.pf-section { border-bottom: 1px solid var(--pf-line); }
.pf-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pf-muted);
}
.pf-section-body { padding: 0 16px 16px; }
.pf-section-lead {
  margin-bottom: 14px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--pf-muted);
}
.pf-tool-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(204, 189, 169, 0.65);
  background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(251,245,236,0.95));
  box-shadow: 0 10px 26px rgba(116, 90, 48, 0.05);
}
.pf-tool-summary-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--pf-text);
  margin-bottom: 4px;
}
.pf-tool-summary-body {
  font-size: 12px;
  line-height: 1.5;
  color: var(--pf-muted);
}
.pf-tool-summary-hint {
  margin-top: 8px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--pf-soft);
}
.pf-kbd {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(204, 189, 169, 0.75);
  background: rgba(255,255,255,0.72);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--pf-accent-strong);
  flex-shrink: 0;
}
.pf-field-help {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--pf-muted);
}
.pf-field-help.warn { color: #98602f; }
.pf-prop-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.pf-prop-label {
  width: 64px;
  flex-shrink: 0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--pf-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pf-prop-val { flex: 1; }
.pf-input,
.pf-select {
  width: 100%;
  min-height: 38px;
  background: rgba(255,255,255,0.9);
  border: 1px solid rgba(204, 189, 169, 0.9);
  border-radius: 12px;
  color: var(--pf-text);
  font-size: 12px;
  padding: 0 12px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.pf-input:focus,
.pf-select:focus {
  border-color: rgba(42, 111, 151, 0.4);
  box-shadow: 0 0 0 4px rgba(42, 111, 151, 0.08);
  background: #fff;
}
.pf-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(42,111,151,0.18), rgba(204,189,169,0.35));
  outline: none;
}
.pf-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: var(--pf-accent);
  box-shadow: 0 4px 12px rgba(42, 111, 151, 0.28);
  cursor: pointer;
}
.pf-select {
  padding-right: 30px;
  font-size: 11px;
}
.pf-checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.pf-checkbox-row input { accent-color: var(--pf-accent); }
.pf-checkbox-row span { font-size: 12px; color: var(--pf-text); }

.pf-swatches {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}
.pf-swatch {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  border: 1px solid rgba(204, 189, 169, 0.84);
  cursor: pointer;
  position: relative;
  transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
}
.pf-swatch:hover {
  transform: translateY(-1px) scale(1.04);
  border-color: rgba(42, 111, 151, 0.18);
  box-shadow: 0 10px 20px rgba(128, 96, 52, 0.12);
}
.pf-swatch.primary::after,
.pf-swatch.secondary::before {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 9px;
  pointer-events: none;
}
.pf-swatch.primary::after { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.92), 0 0 0 2px rgba(42,111,151,0.7); }
.pf-swatch.secondary::before { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.9), 0 0 0 1px rgba(22,50,79,0.72); }
.pf-hex-row { display: flex; gap: 8px; margin-top: 12px; }

.pf-layer-actions {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 0 16px 14px;
}
.pf-layer-abtn {
  min-height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(204, 189, 169, 0.9);
  background: rgba(255,255,255,0.86);
  color: var(--pf-text);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: all 0.15s ease;
}
.pf-layer-abtn:hover {
  color: var(--pf-accent-strong);
  border-color: rgba(42, 111, 151, 0.16);
  background: rgba(255,255,255,0.98);
}
.pf-layer-abtn:disabled {
  opacity: 0.42;
  pointer-events: none;
}
.pf-layer-controls {
  padding: 0 16px 14px;
  display: flex;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid var(--pf-line);
}
.pf-layers-list { flex: 1; overflow-y: auto; padding: 12px; }
.pf-layer {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 16px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease;
}
.pf-layer + .pf-layer { margin-top: 8px; }
.pf-layer:hover {
  background: rgba(255,255,255,0.72);
  border-color: rgba(204, 189, 169, 0.7);
}
.pf-layer.active {
  background: linear-gradient(180deg, rgba(42,111,151,0.12), rgba(255,255,255,0.95));
  border-color: rgba(42, 111, 151, 0.22);
  box-shadow: 0 14px 28px rgba(42, 111, 151, 0.12);
  transform: translateY(-1px);
}
.pf-layer-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.86);
  flex-shrink: 0;
}
.pf-layer-vis {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: none;
  color: var(--pf-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pf-layer-vis:hover {
  color: var(--pf-accent-strong);
  background: rgba(255,255,255,0.88);
  border-color: rgba(204, 189, 169, 0.7);
}
.pf-layer-main { min-width: 0; }
.pf-layer-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--pf-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pf-layer-meta {
  display: flex;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.pf-layer-type,
.pf-layer-tag {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pf-layer-type {
  background: rgba(255,255,255,0.9);
  color: var(--pf-muted);
}
.pf-layer-tag {
  background: rgba(42,111,151,0.08);
  color: var(--pf-accent-strong);
}

.pf-status {
  min-height: 34px;
  background: rgba(255,255,255,0.86);
  border-top: 1px solid var(--pf-line);
  display: flex;
  align-items: center;
  padding: 8px 14px;
  gap: 12px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--pf-muted);
  letter-spacing: 0.04em;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.pf-status-accent { color: var(--pf-accent-strong); }

.pf-toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.96);
  border: 1px solid rgba(42, 111, 151, 0.16);
  color: var(--pf-text);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  padding: 10px 16px;
  letter-spacing: 0.04em;
  z-index: 9999;
  border-radius: 14px;
  box-shadow: var(--pf-shadow);
  animation: pf-toast-in 0.22s ease-out;
}
@keyframes pf-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (max-width: 1100px) {
  .pf-rpanel { width: 288px; }
}

@media (max-width: 920px) {
  .pf-menu { padding: 10px 12px; }
  .pf-menu-meta {
    order: 3;
    margin-left: 0;
    width: 100%;
  }
  .pf-body { flex-direction: column; }
  .pf-toolbar {
    width: 100%;
    flex-direction: row;
    justify-content: flex-start;
    padding: 10px 12px;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--pf-line);
  }
  .pf-toolbar-sep {
    width: 1px;
    height: 34px;
    margin: 0 2px;
    background: linear-gradient(180deg, transparent, var(--pf-line), transparent);
  }
  .pf-color-wells {
    flex-direction: row;
    align-items: center;
    margin-top: 0;
    margin-left: 4px;
  }
  .pf-color-well.secondary {
    margin-top: 0;
    margin-left: -10px;
  }
  .pf-swap-colors { margin-top: 0; margin-left: 8px; }
  .pf-rpanel {
    width: 100%;
    max-height: 40vh;
    border-left: none;
    border-top: 1px solid var(--pf-line);
  }
  .pf-viewport { min-height: 360px; }
}

@media (max-width: 640px) {
  .pf-menu-group,
  .pf-menu-r { width: 100%; }
  .pf-zoom { min-width: 52px; }
  .pf-layer-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pf-swatches { grid-template-columns: repeat(6, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .pf *,
  .pf *::before,
  .pf *::after {
    transition: none !important;
    animation: none !important;
  }
}
`;

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function PixelForge() {
  /* ─── State ─── */
  const [tool, setTool] = useState("brush");
  const [brushSize, setBrushSize] = useState(10);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [color1, setColor1] = useState(DEFAULT_PRIMARY);
  const [color2, setColor2] = useState(DEFAULT_SECONDARY);
  const [color1Input, setColor1Input] = useState(DEFAULT_PRIMARY);
  const [color2Input, setColor2Input] = useState(DEFAULT_SECONDARY);
  const [fillOn, setFillOn] = useState(true);
  const [strokeOn, setStrokeOn] = useState(true);
  const [strokeW, setStrokeW] = useState(2);
  const [layers, setLayers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [docW, setDocW] = useState(DEFAULT_W);
  const [docH, setDocH] = useState(DEFAULT_H);
  const [undoN, setUndoN] = useState(0);
  const [redoN, setRedoN] = useState(0);
  const [toast, setToast] = useState(null);
  const [tick, setTick] = useState(0);

  /* ─── Refs ─── */
  const cvRef = useRef(null);
  const vpRef = useRef(null);
  const doc = useRef({ layers: {}, order: [] });
  const undo = useRef([]);
  const redo = useRef([]);
  const ts = useRef({ down: false, lx: 0, ly: 0, sx: 0, sy: 0, preview: null, drag: null, saved: null, savedOx: 0, savedOy: 0, scrX: 0, scrY: 0 });
  const fileRef = useRef(null);
  const newToast = useRef(null);
  const space = useRef(false);
  const panning = useRef(false);
  const panSt = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const raf = useRef(null);

  const flash = useCallback((msg, ms = 2000) => {
    setToast(msg);
    window.clearTimeout(newToast.current);
    newToast.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  const bump = () => setTick(t => t + 1);

  const syncMeta = useCallback(() => {
    const d = doc.current;
    setLayers(d.order.map(id => {
      const l = d.layers[id];
      return { id: l.id, name: l.name, type: l.type, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked };
    }));
  }, []);

  const syncUndo = useCallback(() => { setUndoN(undo.current.length); setRedoN(redo.current.length); }, []);

  useEffect(() => { setColor1Input(color1); }, [color1]);
  useEffect(() => { setColor2Input(color2); }, [color2]);
  useEffect(() => () => window.clearTimeout(newToast.current), []);

  /* ─── Coordinate transform ─── */
  const s2d = useCallback((sx, sy) => {
    const r = cvRef.current?.getBoundingClientRect();
    return r ? { x: (sx - r.left - pan.x) / zoom, y: (sy - r.top - pan.y) / zoom } : { x: 0, y: 0 };
  }, [zoom, pan]);

  const fitViewTo = useCallback((w, h) => {
    if (!vpRef.current) return;
    const vw = vpRef.current.clientWidth, vh = vpRef.current.clientHeight;
    const s = Math.min((vw - 80) / w, (vh - 80) / h, 1.75);
    setZoom(s);
    setPan({ x: (vw - w * s) / 2, y: (vh - h * s) / 2 });
  }, []);

  const resetDocument = useCallback((w = DEFAULT_W, h = DEFAULT_H) => {
    const next = createDefaultDocument(w, h);
    doc.current = next.doc;
    undo.current = [];
    redo.current = [];
    setDocW(w);
    setDocH(h);
    setActiveId(next.activeId);
    setTool("brush");
    setBrushSize(10);
    setBrushOpacity(1);
    setFillOn(true);
    setStrokeOn(true);
    setStrokeW(2);
    setColor1(DEFAULT_PRIMARY);
    setColor2(DEFAULT_SECONDARY);
    syncMeta();
    syncUndo();
    bump();
    requestAnimationFrame(() => fitViewTo(w, h));
  }, [fitViewTo, syncMeta, syncUndo]);

  function commitColor(which, value) {
    if (which === 1) {
      const next = normalizeHexColor(value, color1);
      setColor1(next);
      setColor1Input(next);
      return;
    }
    const next = normalizeHexColor(value, color2);
    setColor2(next);
    setColor2Input(next);
  }

  function handleNewDocument() {
    if (window.confirm("Create a new document? Unsaved changes will be lost.")) {
      resetDocument();
      flash("New document ready");
    }
  }

  function swapColors() {
    setColor1(color2);
    setColor2(color1);
  }

  /* ─── Init ─── */
  useEffect(() => {
    resetDocument();
  }, [resetDocument]);

  /* ─── Render ─── */
  const render = useCallback(() => {
    const cv = cvRef.current, vp = vpRef.current;
    if (!cv || !vp) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cv.width = vw * dpr; cv.height = vh * dpr;
    cv.style.width = vw + "px"; cv.style.height = vh + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);

    // Viewport bg
    ctx.fillStyle = "#ece4d8";
    ctx.fillRect(0, 0, vw, vh);

    // Subtle grid dots on viewport bg
    ctx.fillStyle = "#d3c8b7";
    for (let gy = 0; gy < vh; gy += 24) for (let gx = 0; gx < vw; gx += 24) ctx.fillRect(gx, gy, 1, 1);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Checkerboard
    const cs = CHECKER;
    for (let cy = 0; cy < docH; cy += cs) {
      for (let cx = 0; cx < docW; cx += cs) {
        ctx.fillStyle = (Math.floor(cx / cs) + Math.floor(cy / cs)) % 2 === 0 ? "#faf7f1" : "#eee5d8";
        ctx.fillRect(cx, cy, cs, cs);
      }
    }

    // Layers
    const d = doc.current;
    for (const id of d.order) {
      const l = d.layers[id];
      if (!l || !l.visible) continue;
      ctx.save();
      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = l.blend;
      ctx.translate(l.ox, l.oy);
      if (l.type === "raster" && l.canvas) ctx.drawImage(l.canvas, 0, 0);
      else if (l.type === "vector") l.shapes.forEach(s => drawShape(ctx, s));
      ctx.restore();
    }

    // Preview shape
    if (ts.current.preview) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      drawShape(ctx, ts.current.preview);
      ctx.restore();
    }

    // Canvas border
    ctx.strokeStyle = "#bfae98";
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(0, 0, docW, docH);

    // Corner marks
    const cm = 12 / zoom;
    ctx.strokeStyle = "rgba(42,111,151,0.35)";
    ctx.lineWidth = 1.5 / zoom;
    [[0,0,cm,0,0,cm],[docW,0,-cm,0,0,cm],[0,docH,cm,0,0,-cm],[docW,docH,-cm,0,0,-cm]].forEach(([x,y,dx1,dy1,dx2,dy2]) => {
      ctx.beginPath(); ctx.moveTo(x+dx1,y+dy1); ctx.lineTo(x,y); ctx.lineTo(x+dx2,y+dy2); ctx.stroke();
    });

    ctx.restore();

    // Brush cursor
    if (["brush","eraser"].includes(tool) && !panning.current) {
      const r = (brushSize * zoom) / 2;
      ctx.save();
      ctx.strokeStyle = tool === "eraser" ? "rgba(208,100,69,0.72)" : "rgba(42,111,151,0.72)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ts.current.scrX, ts.current.scrY, Math.max(r, 2), 0, Math.PI * 2);
      ctx.stroke();
      // Center dot
      ctx.fillStyle = tool === "eraser" ? "#d06445" : DEFAULT_PRIMARY;
      ctx.beginPath();
      ctx.arc(ts.current.scrX, ts.current.scrY, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [pan, zoom, docW, docH, tool, brushSize, tick]);

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(render);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [render]);

  useEffect(() => {
    const obs = new ResizeObserver(() => bump());
    if (vpRef.current) obs.observe(vpRef.current);
    return () => obs.disconnect();
  }, []);

  /* ─── Undo / Redo ─── */
  function pushU(entry) {
    undo.current.push(entry);
    if (undo.current.length > 60) undo.current.shift();
    redo.current = [];
    syncUndo();
  }

  function doUndo() {
    if (!undo.current.length) return;
    const e = undo.current.pop();
    if (e.t === "raster") {
      const l = doc.current.layers[e.lid];
      if (l?.canvas) {
        const c = l.canvas.getContext("2d");
        const cur = c.getImageData(0, 0, l.canvas.width, l.canvas.height);
        redo.current.push({ ...e, img: cur });
        c.putImageData(e.img, 0, 0);
      }
    } else if (e.t === "vadd") {
      const l = doc.current.layers[e.lid];
      if (l) { const rm = l.shapes.pop(); redo.current.push({ ...e, shape: rm }); }
    } else if (e.t === "move") {
      const l = doc.current.layers[e.lid];
      if (l) {
        const cx = l.ox, cy = l.oy;
        l.ox = e.oox; l.oy = e.ooy;
        redo.current.push({ ...e, oox: cx, ooy: cy });
      }
    }
    syncUndo(); bump();
  }

  function doRedo() {
    if (!redo.current.length) return;
    const e = redo.current.pop();
    if (e.t === "raster") {
      const l = doc.current.layers[e.lid];
      if (l?.canvas) {
        const c = l.canvas.getContext("2d");
        const cur = c.getImageData(0, 0, l.canvas.width, l.canvas.height);
        undo.current.push({ ...e, img: cur });
        c.putImageData(e.img, 0, 0);
      }
    } else if (e.t === "vadd") {
      const l = doc.current.layers[e.lid];
      if (l && e.shape) { l.shapes.push(e.shape); undo.current.push(e); }
    } else if (e.t === "move") {
      const l = doc.current.layers[e.lid];
      if (l) {
        const cx = l.ox, cy = l.oy;
        l.ox = e.oox; l.oy = e.ooy;
        undo.current.push({ ...e, oox: cx, ooy: cy });
      }
    }
    syncUndo(); bump();
  }

  /* ─── Brush drawing ─── */
  function stamp(ctx, x, y, sz, col, op, erase) {
    ctx.save();
    ctx.globalAlpha = op;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.fillStyle = erase ? "rgba(0,0,0,1)" : col;
    ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function brushLine(ctx, x0, y0, x1, y1, sz, col, op, erase) {
    const d = dist(x0, y0, x1, y1), step = Math.max(0.5, sz * 0.15);
    const n = Math.max(1, Math.ceil(d / step));
    for (let i = 0; i <= n; i++) { const t = i / n; stamp(ctx, lerp(x0, x1, t), lerp(y0, y1, t), sz, col, op, erase); }
  }

  /* ─── Pointer events ─── */
  function onDown(e) {
    e.preventDefault();
    if (e.button === 1 || (e.button === 0 && space.current)) {
      panning.current = true;
      panSt.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
      return;
    }
    if (e.button !== 0) return;

    const p = s2d(e.clientX, e.clientY);
    const t = ts.current;
    t.down = true; t.sx = p.x; t.sy = p.y; t.lx = p.x; t.ly = p.y;
    const layer = doc.current.layers[activeId];
    if (!layer) return;

    if (tool === "brush" || tool === "eraser") {
      if (layer.type !== "raster") { flash("Select a raster layer for " + tool); t.down = false; return; }
      const c = layer.canvas.getContext("2d");
      t.saved = c.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
      stamp(c, p.x - layer.ox, p.y - layer.oy, brushSize, color1, brushOpacity, tool === "eraser");
      bump();
    } else if (tool === "move") {
      t.savedOx = layer.ox; t.savedOy = layer.oy; t.drag = null;
      if (layer.type === "vector") {
        for (let i = layer.shapes.length - 1; i >= 0; i--) {
          if (hitShape(layer.shapes[i], p.x - layer.ox, p.y - layer.oy)) {
            const s = layer.shapes[i];
            t.drag = { idx: i, sx: s.type === "line" ? s.x1 : s.x, sy: s.type === "line" ? s.y1 : s.y };
            break;
          }
        }
      }
    } else if (["rect","ellipse","line"].includes(tool)) {
      if (layer.type !== "vector") { flash("Select a vector layer for shapes"); t.down = false; return; }
    } else if (tool === "eyedropper") {
      const cv = cvRef.current;
      if (cv) {
        const dpr = window.devicePixelRatio || 1;
        const r = cv.getBoundingClientRect();
        const px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr;
        const d = cv.getContext("2d").getImageData(px, py, 1, 1).data;
        if (d[3] > 0) { const h = rgbHex(d[0], d[1], d[2]); setColor1(h); flash("Picked " + h); }
      }
    }
  }

  function onMove(e) {
    const r = cvRef.current?.getBoundingClientRect();
    if (r) { ts.current.scrX = e.clientX - r.left; ts.current.scrY = e.clientY - r.top; }

    if (panning.current) {
      setPan({ x: panSt.current.ox + e.clientX - panSt.current.x, y: panSt.current.oy + e.clientY - panSt.current.y });
      return;
    }
    if (!ts.current.down) { if (["brush","eraser"].includes(tool)) bump(); return; }

    const p = s2d(e.clientX, e.clientY);
    const t = ts.current;
    const layer = doc.current.layers[activeId];
    if (!layer) return;

    if (tool === "brush" || tool === "eraser") {
      if (layer.type === "raster") {
        brushLine(layer.canvas.getContext("2d"), t.lx - layer.ox, t.ly - layer.oy, p.x - layer.ox, p.y - layer.oy, brushSize, color1, brushOpacity, tool === "eraser");
        bump();
      }
    } else if (tool === "move") {
      const dx = p.x - t.sx, dy = p.y - t.sy;
      if (layer.type === "vector" && t.drag) {
        const s = layer.shapes[t.drag.idx];
        if (s.type === "line") {
          const dsx = s.x2 - s.x1, dsy = s.y2 - s.y1;
          s.x1 = t.drag.sx + dx; s.y1 = t.drag.sy + dy; s.x2 = s.x1 + dsx; s.y2 = s.y1 + dsy;
        } else { s.x = t.drag.sx + dx; s.y = t.drag.sy + dy; }
      } else { layer.ox = t.savedOx + dx; layer.oy = t.savedOy + dy; }
      bump();
    } else if (["rect","ellipse"].includes(tool)) {
      const ox = layer.ox, oy = layer.oy;
      t.preview = { type: tool, x: Math.min(t.sx, p.x) - ox, y: Math.min(t.sy, p.y) - oy, w: Math.abs(p.x - t.sx), h: Math.abs(p.y - t.sy), fill: fillOn ? color1 : null, stroke: strokeOn ? color2 : null, strokeWidth: strokeW };
      bump();
    } else if (tool === "line") {
      t.preview = { type: "line", x1: t.sx - layer.ox, y1: t.sy - layer.oy, x2: p.x - layer.ox, y2: p.y - layer.oy, stroke: color1, strokeWidth: strokeW };
      bump();
    }
    t.lx = p.x; t.ly = p.y;
  }

  function onUp() {
    if (panning.current) { panning.current = false; return; }
    const t = ts.current;
    if (!t.down) return;
    t.down = false;
    const layer = doc.current.layers[activeId];

    if ((tool === "brush" || tool === "eraser") && layer?.type === "raster" && t.saved) {
      pushU({ t: "raster", lid: layer.id, img: t.saved }); t.saved = null;
    } else if (["rect","ellipse","line"].includes(tool) && layer?.type === "vector" && t.preview) {
      layer.shapes.push({ ...t.preview });
      pushU({ t: "vadd", lid: layer.id }); t.preview = null;
    } else if (tool === "move" && layer) {
      if (t.savedOx !== layer.ox || t.savedOy !== layer.oy) pushU({ t: "move", lid: layer.id, oox: t.savedOx, ooy: t.savedOy });
      t.drag = null;
    }
    bump();
  }

  /* ─── Keyboard ─── */
  useEffect(() => {
    const kd = (e) => {
      const typing = isEditableTarget(e.target);
      const key = e.key.toLowerCase();
      if (e.code === "Space" && !typing) { space.current = true; e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && key === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "y") { e.preventDefault(); doRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); handleSave(); return; }
      if (typing) return;
      const sc = { v:"move", b:"brush", e:"eraser", r:"rect", o:"ellipse", l:"line", i:"eyedropper" };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && sc[key]) setTool(sc[key]);
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key === "x") swapColors();
      if (e.key === "[") setBrushSize(s => Math.max(1, s - 2));
      if (e.key === "]") setBrushSize(s => Math.min(200, s + 2));
    };
    const ku = (e) => { if (e.code === "Space") space.current = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [handleSave, swapColors]);

  /* ─── Wheel ─── */
  function onWheel(e) {
    e.preventDefault();
    const r = cvRef.current?.getBoundingClientRect();
    if (!r) return;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const f = e.deltaY < 0 ? 1.12 : 0.89;
    const nz = clamp(zoom * f, MIN_ZOOM, MAX_ZOOM);
    const k = nz / zoom;
    setPan(p => ({ x: mx - k * (mx - p.x), y: my - k * (my - p.y) }));
    setZoom(nz);
  }

  /* ─── Layer ops ─── */
  function addLayer(type) {
    const d = doc.current;
    const l = type === "raster"
      ? { id: uid(), name: "Layer " + (d.order.length + 1), type: "raster", visible: true, opacity: 1, blend: "source-over", locked: false, canvas: makeCanvas(docW, docH), ox: 0, oy: 0 }
      : { id: uid(), name: "Vector " + (d.order.length + 1), type: "vector", visible: true, opacity: 1, blend: "source-over", locked: false, shapes: [], ox: 0, oy: 0 };
    d.layers[l.id] = l; d.order.push(l.id);
    setActiveId(l.id); syncMeta(); bump();
  }

  function delLayer(id) {
    const d = doc.current;
    if (d.order.length <= 1) { flash("Need at least one layer"); return; }
    d.order = d.order.filter(x => x !== id); delete d.layers[id];
    if (activeId === id) setActiveId(d.order[d.order.length - 1]);
    syncMeta(); bump();
  }

  function moveLayer(id, dir) {
    const d = doc.current, i = d.order.indexOf(id), j = i + dir;
    if (j < 0 || j >= d.order.length) return;
    [d.order[i], d.order[j]] = [d.order[j], d.order[i]];
    syncMeta(); bump();
  }

  function toggleVis(id) { const l = doc.current.layers[id]; if (l) { l.visible = !l.visible; syncMeta(); bump(); } }
  function setOpacity(id, v) { const l = doc.current.layers[id]; if (l) { l.opacity = v; syncMeta(); bump(); } }
  function setBlend(id, m) { const l = doc.current.layers[id]; if (l) { l.blend = m; syncMeta(); bump(); } }

  /* ─── Save / Load / Export ─── */
  function handleSave() {
    try {
      const d = doc.current;
      const out = { v: 1, w: docW, h: docH, aid: activeId, layers: d.order.map(id => {
        const l = d.layers[id];
        const b = { id: l.id, name: l.name, type: l.type, visible: l.visible, opacity: l.opacity, blend: l.blend, ox: l.ox, oy: l.oy };
        if (l.type === "raster") b.data = l.canvas.toDataURL("image/png");
        else b.shapes = JSON.parse(JSON.stringify(l.shapes));
        return b;
      })};
      const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.pforge";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      flash("Project saved");
    } catch (err) { flash("Save error: " + err.message); }
  }

  function handleLoad() { fileRef.current?.click(); }

  async function onFileChange(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data.v !== 1) throw new Error("Bad format");
      const nd = { layers: {}, order: [] };
      for (const ld of data.layers) {
        if (ld.type === "raster") {
          const l = { ...ld, canvas: makeCanvas(data.w, data.h) };
          if (ld.data) {
            const img = new window.Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = ld.data; });
            l.canvas.getContext("2d").drawImage(img, 0, 0);
          }
          delete l.data;
          nd.layers[l.id] = l; nd.order.push(l.id);
        } else {
          nd.layers[ld.id] = { ...ld }; nd.order.push(ld.id);
        }
      }
      doc.current = nd; setDocW(data.w); setDocH(data.h); setActiveId(data.aid || nd.order[0]);
      undo.current = []; redo.current = []; syncUndo(); syncMeta(); bump();
      requestAnimationFrame(() => fitViewTo(data.w, data.h));
      flash("Loaded " + f.name);
    } catch (err) { flash("Load error: " + err.message); }
    e.target.value = "";
  }

  function handleExport() {
    const ec = makeCanvas(docW, docH), ctx = ec.getContext("2d");
    const d = doc.current;
    for (const id of d.order) {
      const l = d.layers[id]; if (!l?.visible) continue;
      ctx.save(); ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = l.blend; ctx.translate(l.ox, l.oy);
      if (l.type === "raster") ctx.drawImage(l.canvas, 0, 0);
      else l.shapes.forEach(s => drawShape(ctx, s));
      ctx.restore();
    }
    const a = document.createElement("a"); a.href = ec.toDataURL("image/png"); a.download = "export.png"; a.click();
    flash("Exported PNG");
  }

  function fitView() { fitViewTo(docW, docH); }

  /* ─── Derived ─── */
  const activeLayer = layers.find(l => l.id === activeId);
  const toolMeta = TOOLS.find(t => t.id === tool) || TOOLS[0];
  const toolCopy = TOOL_COPY[toolMeta.id];
  const toolCompatible = !activeLayer || (activeLayer.type === "raster" ? toolMeta.raster : toolMeta.vector);
  const activeIndex = activeId ? doc.current.order.indexOf(activeId) : -1;
  const canMoveDown = activeIndex > 0;
  const canMoveUp = activeIndex >= 0 && activeIndex < doc.current.order.length - 1;
  const cursorStyle = panning.current ? "grabbing" : space.current ? "grab" : (tool === "eyedropper" ? "crosshair" : ["brush","eraser","rect","ellipse","line"].includes(tool) ? "none" : "default");

  /* ═══════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════ */
  return (
    <div className="pf">
      <style>{CSS}</style>
      <input ref={fileRef} type="file" accept=".pforge,.json" style={{ display: "none" }} onChange={onFileChange} />

      {/* ── Menu Bar ── */}
      <div className="pf-menu">
        <div className="pf-menu-group">
          <span className="pf-menu-brand">PixelForge</span>
          <div className="pf-menu-sep" />
          <button className="pf-mbtn" onClick={handleNewDocument} title="Create a new document">New</button>
          <button className="pf-mbtn" onClick={handleLoad} title="Open a saved PixelForge project"><FolderOpen size={12} /> Open</button>
          <button className="pf-mbtn" onClick={handleSave} title="Save project"><Save size={12} /> Save</button>
          <button className="pf-mbtn primary" onClick={handleExport} title="Export a flattened PNG"><Download size={12} /> Export PNG</button>
          <div className="pf-menu-sep" />
          <button className={`pf-mbtn ${undoN === 0 ? "dis" : ""}`} onClick={doUndo} title="Undo (Cmd/Ctrl+Z)"><Undo2 size={12} /> Undo</button>
          <button className={`pf-mbtn ${redoN === 0 ? "dis" : ""}`} onClick={doRedo} title="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)"><Redo2 size={12} /> Redo</button>
        </div>

        <div className="pf-menu-meta">
          <span className="pf-menu-chip accent">{toolMeta.label}</span>
          {activeLayer && <span className="pf-menu-chip">{activeLayer.name}</span>}
          <span className="pf-menu-chip">{docW} × {docH}</span>
        </div>

        <div className="pf-menu-r">
          <button className="pf-mbtn" onClick={() => setZoom(z => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM))} title="Zoom in"><ZoomIn size={12} /></button>
          <span className="pf-zoom">{(zoom * 100).toFixed(0)}%</span>
          <button className="pf-mbtn" onClick={() => setZoom(z => clamp(z * 0.8, MIN_ZOOM, MAX_ZOOM))} title="Zoom out"><ZoomOut size={12} /></button>
          <button className="pf-mbtn" onClick={fitView} title="Fit document to view"><Maximize2 size={11} /> Fit</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="pf-body">

        {/* ── Toolbar ── */}
        <div className="pf-toolbar">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`pf-tbtn ${tool === t.id ? "active" : ""} ${activeLayer && !(activeLayer.type === "raster" ? t.raster : t.vector) ? "muted" : ""}`}
              onClick={() => setTool(t.id)}
              title={`${t.label} (${t.shortcut})`}
              aria-pressed={tool === t.id}
            >
              <t.icon size={16} />
              <span className="pf-shortcut">{t.shortcut}</span>
            </button>
          ))}
          <div className="pf-toolbar-sep" />
          <div className="pf-color-wells">
            <label className="pf-color-well primary" title="Primary color">
              <span className="pf-color-button-label">P</span>
              <span className="pf-color-button-swatch" style={{ background: color1 }} />
              <input className="pf-color-input" type="color" value={normalizeHexColor(color1, DEFAULT_PRIMARY)} onChange={e => setColor1(e.target.value)} aria-label="Choose primary color" />
            </label>
            <label className="pf-color-well secondary" title="Secondary color">
              <span className="pf-color-button-label">S</span>
              <span className="pf-color-button-swatch" style={{ background: color2 }} />
              <input className="pf-color-input" type="color" value={normalizeHexColor(color2, DEFAULT_SECONDARY)} onChange={e => setColor2(e.target.value)} aria-label="Choose secondary color" />
            </label>
            <button className="pf-swap-colors" onClick={swapColors} title="Swap colors (X)" aria-label="Swap primary and secondary colors">⇄</button>
          </div>
        </div>

        {/* ── Canvas Viewport ── */}
        <div ref={vpRef} className="pf-viewport" style={{ cursor: cursorStyle }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerCancel={onUp}
          onWheel={onWheel} onContextMenu={e => e.preventDefault()}>
          <canvas ref={cvRef} />
        </div>

        {/* ── Right Panel ── */}
        <div className="pf-rpanel">

          {/* Properties */}
          <div className="pf-section">
            <div className="pf-section-head">Tool Settings</div>
            <div className="pf-section-body">
              <div className="pf-tool-summary">
                <div>
                  <div className="pf-tool-summary-title">{toolCopy.title}</div>
                  <div className="pf-tool-summary-body">{toolCopy.description}</div>
                  <div className="pf-tool-summary-hint">{toolCopy.hint}</div>
                </div>
                <span className="pf-kbd">{toolMeta.shortcut}</span>
              </div>

              {!toolCompatible && activeLayer && (
                <div className="pf-field-help warn">
                  {toolMeta.label} works on {toolMeta.raster && toolMeta.vector ? "all" : toolMeta.raster ? "raster" : "vector"} layers. The current layer is {activeLayer.type}.
                </div>
              )}

              {["brush","eraser"].includes(tool) && (<>
                <div className="pf-prop-row">
                  <span className="pf-prop-label">Size</span>
                  <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="range" className="pf-slider" min={1} max={200} value={brushSize} onChange={e => setBrushSize(+e.target.value)} />
                    <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 28, textAlign: "right" }}>{brushSize}</span>
                  </div>
                </div>
                <div className="pf-prop-row">
                  <span className="pf-prop-label">Opacity</span>
                  <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="range" className="pf-slider" min={0} max={100} value={Math.round(brushOpacity * 100)} onChange={e => setBrushOpacity(e.target.value / 100)} />
                    <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 28, textAlign: "right" }}>{Math.round(brushOpacity * 100)}%</span>
                  </div>
                </div>
                <div className="pf-field-help">Brush opacity and size carry across both paint and erase modes.</div>
              </>)}
              {["rect","ellipse","line"].includes(tool) && (<>
                <div className="pf-prop-row">
                  <label className="pf-checkbox-row"><input type="checkbox" checked={fillOn} onChange={e => setFillOn(e.target.checked)} /><span>Fill</span></label>
                  {tool !== "line" && <label className="pf-checkbox-row" style={{ marginLeft: 12 }}><input type="checkbox" checked={strokeOn} onChange={e => setStrokeOn(e.target.checked)} /><span>Stroke</span></label>}
                </div>
                <div className="pf-prop-row">
                  <span className="pf-prop-label">Width</span>
                  <div className="pf-prop-val" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="range" className="pf-slider" min={1} max={40} value={strokeW} onChange={e => setStrokeW(+e.target.value)} />
                    <span style={{ fontSize: 10, color: "#6c7a84", minWidth: 20, textAlign: "right" }}>{strokeW}</span>
                  </div>
                </div>
                <div className="pf-field-help">Primary color fills the shape. Secondary color is used for outlines when stroke is enabled.</div>
              </>)}
            </div>
          </div>

          {/* Color Palette */}
          <div className="pf-section">
            <div className="pf-section-head">Palette</div>
            <div className="pf-section-body">
              <div className="pf-section-lead">Click a swatch to set the primary color. Right-click a swatch to assign the secondary color, or edit the hex values directly.</div>
              <div className="pf-swatches">
                {SWATCHES.map(c => (
                  <div
                    key={c}
                    className={`pf-swatch ${c.toLowerCase() === color1.toLowerCase() ? "primary" : ""} ${c.toLowerCase() === color2.toLowerCase() ? "secondary" : ""}`}
                    style={{ background: c }}
                    onClick={() => setColor1(c)}
                    onContextMenu={e => { e.preventDefault(); setColor2(c); }}
                    title={c}
                  />
                ))}
              </div>
              <div className="pf-hex-row">
                <input
                  className="pf-input"
                  style={{ flex: 1 }}
                  spellCheck={false}
                  value={color1Input}
                  onChange={e => setColor1Input(e.target.value)}
                  onBlur={() => commitColor(1, color1Input)}
                  onKeyDown={e => { if (e.key === "Enter") { commitColor(1, color1Input); e.currentTarget.blur(); } }}
                  title="Primary"
                  aria-label="Primary color hex value"
                />
                <input
                  className="pf-input"
                  style={{ flex: 1 }}
                  spellCheck={false}
                  value={color2Input}
                  onChange={e => setColor2Input(e.target.value)}
                  onBlur={() => commitColor(2, color2Input)}
                  onKeyDown={e => { if (e.key === "Enter") { commitColor(2, color2Input); e.currentTarget.blur(); } }}
                  title="Secondary"
                  aria-label="Secondary color hex value"
                />
              </div>
            </div>
          </div>

          {/* Layers */}
          <div className="pf-section" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="pf-section-head">
              <span>Layers</span>
              <span style={{ fontSize: 8, color: "#95a1a9" }}>{layers.length}</span>
            </div>
            <div className="pf-layer-actions">
              <button className="pf-layer-abtn" onClick={() => addLayer("raster")} title="Add raster layer"><Plus size={10} /><Image size={10} /> Raster</button>
              <button className="pf-layer-abtn" onClick={() => addLayer("vector")} title="Add vector layer"><Plus size={10} /><Square size={10} /> Vector</button>
              <button className="pf-layer-abtn" onClick={() => activeId && delLayer(activeId)} disabled={!activeId || layers.length <= 1} title="Delete active layer"><Trash2 size={10} /></button>
              <button className="pf-layer-abtn" onClick={() => activeId && moveLayer(activeId, 1)} disabled={!canMoveUp} title="Move layer up"><ChevronUp size={10} /></button>
              <button className="pf-layer-abtn" onClick={() => activeId && moveLayer(activeId, -1)} disabled={!canMoveDown} title="Move layer down"><ChevronDown size={10} /></button>
            </div>

            {/* Active layer blend/opacity */}
            {activeLayer && (
              <div className="pf-layer-controls">
                <select className="pf-select" style={{ width: 124 }} value={activeLayer.blend} onChange={e => setBlend(activeId, e.target.value)} aria-label="Blend mode">
                  {BLENDS.map(b => <option key={b} value={b}>{b === "source-over" ? "Normal" : b}</option>)}
                </select>
                <input type="range" className="pf-slider" style={{ flex: 1 }} min={0} max={100} value={Math.round(activeLayer.opacity * 100)} onChange={e => setOpacity(activeId, e.target.value / 100)} />
                <span style={{ fontSize: 9, color: "#6c7a84", minWidth: 28 }}>{Math.round(activeLayer.opacity * 100)}%</span>
              </div>
            )}

            <div className="pf-layers-list">
              {[...layers].reverse().map(l => (
                <div key={l.id} className={`pf-layer ${l.id === activeId ? "active" : ""}`} onClick={() => setActiveId(l.id)}>
                  <button className="pf-layer-vis" onClick={e => { e.stopPropagation(); toggleVis(l.id); }} title={l.visible ? "Hide layer" : "Show layer"}>
                    {l.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <span className="pf-layer-icon" style={{ color: l.type === "raster" ? "#49697b" : "#8c6740" }}>
                    {l.type === "raster" ? <Image size={12} /> : <Square size={12} />}
                  </span>
                  <div className="pf-layer-main">
                    <div className="pf-layer-name">{l.name}</div>
                    <div className="pf-layer-meta">
                      <span className="pf-layer-type">{l.type === "raster" ? "PX" : "VEC"}</span>
                      {l.blend !== "source-over" && <span className="pf-layer-tag">{l.blend}</span>}
                      {Math.round(l.opacity * 100) !== 100 && <span className="pf-layer-tag">{Math.round(l.opacity * 100)}%</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="pf-status">
        <span>{docW} × {docH}</span>
        <span className="pf-status-accent">{(zoom * 100).toFixed(0)}%</span>
        {activeLayer && <span>{activeLayer.name} <span style={{ color: "#c8b9a8" }}>|</span> {activeLayer.type === "raster" ? "RASTER" : "VECTOR"}</span>}
        <span>{toolMeta.label}</span>
        <span style={{ marginLeft: "auto" }}>Space drag pans · Scroll zooms · X swaps colors · [ ] resizes brush</span>
      </div>

      {/* ── Toast ── */}
      {toast && <div className="pf-toast">{toast}</div>}
    </div>
  );
}
