import {
  MousePointer2, Pencil, Eraser, Square, Circle, Minus, Pipette, Type, SquareDashed, PaintBucket,
  Lasso, WandSparkles, Blend, Pentagon, Star, PenTool, Hand,
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
    collapsedSections: {},
    showGrid: false,
    showRulers: false,
    snapToGrid: false,
    pixelPreview: false,
    darkMode: false,
  },
  toolPrefs: {
    lastRasterTool: "brush",
    lastVectorTool: "rect",
    brushSize: 10,
    brushOpacity: 1,
    brushPreset: "soft",
    strokeWidth: 2,
    fillOn: true,
    strokeOn: true,
    bucketTolerance: 16,
    gradientMode: "linear",
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
    lastExport: { format: "png", quality: 0.92, scale: 1, includeBackground: true, selectedOnly: false, filename: "pixelforge-export" },
  },
  behaviorPrefs: {
    autoSwitchLayerForTool: true,
    highlightLikelyLayer: true,
    showStarterActions: true,
  },
};

export const TOOLS = [
  { id: "move", label: "Move", icon: MousePointer2, shortcut: "V", raster: true, vector: true, text: true },
  { id: "hand", label: "Hand", icon: Hand, shortcut: "H", raster: true, vector: true, text: true },
  { id: "marquee", label: "Marquee Select", icon: SquareDashed, shortcut: "M", raster: true, vector: false, text: false },
  { id: "lasso", label: "Lasso Select", icon: Lasso, shortcut: "A", raster: true, vector: false, text: false },
  { id: "magic", label: "Magic Wand", icon: WandSparkles, shortcut: "W", raster: true, vector: false, text: false },
  { id: "brush", label: "Brush", icon: Pencil, shortcut: "B", raster: true, vector: false, text: false },
  { id: "eraser", label: "Eraser", icon: Eraser, shortcut: "E", raster: true, vector: false, text: false },
  { id: "bucket", label: "Bucket Fill", icon: PaintBucket, shortcut: "G", raster: true, vector: false, text: false },
  { id: "gradient", label: "Gradient", icon: Blend, shortcut: "N", raster: true, vector: false, text: false },
  { id: "rect", label: "Rectangle", icon: Square, shortcut: "R", raster: false, vector: true, text: false },
  { id: "ellipse", label: "Ellipse", icon: Circle, shortcut: "O", raster: false, vector: true, text: false },
  { id: "polygon", label: "Polygon", icon: Pentagon, shortcut: "P", raster: false, vector: true, text: false },
  { id: "star", label: "Star", icon: Star, shortcut: "S", raster: false, vector: true, text: false },
  { id: "line", label: "Line", icon: Minus, shortcut: "L", raster: false, vector: true, text: false },
  { id: "pen", label: "Pen Path", icon: PenTool, shortcut: "K", raster: false, vector: true, text: false },
  { id: "text", label: "Text", icon: Type, shortcut: "T", raster: false, vector: false, text: true },
  { id: "eyedropper", label: "Eyedropper", icon: Pipette, shortcut: "I", raster: true, vector: true, text: true },
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
  hand: {
    title: "Hand",
    description: "Pan around the canvas without changing artwork.",
    hint: "Hold Space for temporary hand-pan from any tool.",
  },
  lasso: {
    title: "Lasso",
    description: "Draw a freehand raster selection and convert it into editable selection bounds.",
    hint: "Release to capture the bounds. Cmd+C/Cmd+X work on the result.",
  },
  magic: {
    title: "Magic Wand",
    description: "Select connected pixels that match the clicked color within tolerance.",
    hint: "Uses the bucket tolerance slider.",
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
  bucket: {
    title: "Bucket Fill",
    description: "Fill connected raster regions with the primary color.",
    hint: "Raise tolerance to fill nearby shades in the same click.",
  },
  gradient: {
    title: "Gradient",
    description: "Drag a primary-to-secondary gradient across the active raster layer.",
    hint: "Set endpoints with the two color wells.",
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
  polygon: {
    title: "Polygon",
    description: "Drag a five-sided vector polygon with fill and stroke controls.",
    hint: "Adjust fill, stroke, and bounds from Selection.",
  },
  star: {
    title: "Star",
    description: "Drag a vector star for badges, markers, and callouts.",
    hint: "Primary fills and secondary outlines.",
  },
  line: {
    title: "Line",
    description: "Create direct vector strokes for guides, dividers, and layout scaffolding.",
    hint: "Secondary stroke width applies to each line segment.",
  },
  pen: {
    title: "Pen Path",
    description: "Drag quick editable vector path strokes.",
    hint: "Use this for custom straight path segments.",
  },
  marquee: {
    title: "Marquee",
    description: "Drag a rectangle to select pixels. Cut, copy, paste, or drag to move the region.",
    hint: "Ctrl+C copies, Ctrl+V pastes as a new layer, arrow keys nudge, Esc clears.",
  },
  text: {
    title: "Text",
    description: "Place editable type layers on the canvas with font, weight, and color controls.",
    hint: "Click to place. Press Enter to commit, Esc to cancel.",
  },
  eyedropper: {
    title: "Eyedropper",
    description: "Sample any visible color from the composited canvas output.",
    hint: "Click once to replace the primary color with the sampled value.",
  },
};
