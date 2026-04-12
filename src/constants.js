import {
  MousePointer2, Pencil, Eraser, Square, Circle, Minus, Pipette,
} from "lucide-react";

export const DEFAULT_W = 1200, DEFAULT_H = 800;
export const MIN_ZOOM = 0.02, MAX_ZOOM = 64;
export const CHECKER = 10;
export const AUTOSAVE_KEY = "PixelForge.autosave.v3";
export const AUTOSAVE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
export const PREFS_KEY = "PixelForge.prefs.v1";
export const DEFAULT_PRIMARY = "#2a6f97";
export const DEFAULT_SECONDARY = "#16324f";
export const DEFAULT_BG = "#ffffff";
export const HISTORY_LIMIT = 80;
export const MOBILE_BREAKPOINT = 920;
export const RECENT_COLORS_LIMIT = 8;
export const RECENT_SIZES_LIMIT = 5;
export const RECENT_PRESETS_LIMIT = 4;
export const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const RESIZE_ANCHORS = [
  ["nw", "n", "ne"],
  ["w", "center", "e"],
  ["sw", "s", "se"],
];

export const DEFAULT_PREFS = {
  uiPrefs: {
    mobileTab: "next",
  },
  toolPrefs: {
    lastRasterTool: "brush",
    lastVectorTool: "rect",
    brushSize: 10,
    brushOpacity: 1,
    strokeWidth: 2,
    fillOn: true,
    strokeOn: true,
    recentColors: [DEFAULT_PRIMARY, DEFAULT_SECONDARY],
    recentBrushSizes: [6, 10, 24],
  },
  docPrefs: {
    lastNewDoc: { width: DEFAULT_W, height: DEFAULT_H, background: DEFAULT_BG },
    recentDocPresets: [
      { width: DEFAULT_W, height: DEFAULT_H, background: DEFAULT_BG },
      { width: 1080, height: 1080, background: DEFAULT_BG },
      { width: 1600, height: 900, background: DEFAULT_BG },
    ],
    lastResizeAnchor: "center",
  },
  behaviorPrefs: {
    autoSwitchLayerForTool: true,
    highlightLikelyLayer: true,
    showStarterActions: true,
  },
};

export const TOOLS = [
  { id: "move", label: "Move", icon: MousePointer2, shortcut: "V", raster: true, vector: true },
  { id: "brush", label: "Brush", icon: Pencil, shortcut: "B", raster: true, vector: false },
  { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "E", raster: true, vector: false },
  { id: "rect", label: "Rectangle", icon: Square, shortcut: "R", raster: false, vector: true },
  { id: "ellipse", label: "Ellipse", icon: Circle, shortcut: "O", raster: false, vector: true },
  { id: "line", label: "Line", icon: Minus, shortcut: "L", raster: false, vector: true },
  { id: "eyedropper", label: "Eyedropper", icon: Pipette, shortcut: "I", raster: true, vector: true },
];

export const BLENDS = [
  "source-over", "multiply", "screen", "overlay", "darken",
  "lighten", "color-dodge", "color-burn", "hard-light",
  "soft-light", "difference", "exclusion",
];

export const SWATCHES = [
  "#000000","#ffffff","#d63031","#e17055","#fdcb6e","#00b894",
  "#0984e3","#6c5ce7","#fd79a8","#636e72","#2d3436","#dfe6e9",
  "#fab1a0","#ffeaa7","#55efc4","#74b9ff","#a29bfe","#ff7675",
  "#b2bec3","#81ecec","#f8c291","#e77f67","#cf6a87","#574b90",
];

export const TOOL_COPY = {
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
