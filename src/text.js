export const DEFAULT_TEXT_LAYER = {
  text: "Text",
  fontFamily: "Inter, -apple-system, sans-serif",
  fontSize: 48,
  fontWeight: 400,
  italic: false,
  color: "#1b2a33",
  align: "left",
  maxWidth: null,
};

export const FONT_FAMILIES = [
  { id: "system-sans",  label: "System Sans",  css: "Inter, -apple-system, sans-serif" },
  { id: "system-serif", label: "System Serif", css: "Georgia, serif" },
  { id: "system-mono",  label: "System Mono",  css: "\"Courier New\", monospace" },
  { id: "system-arial", label: "Arial",        css: "Arial, sans-serif" },
  { id: "inter",        label: "Inter",        css: "Inter, sans-serif" },
  { id: "playfair",     label: "Playfair",     css: "\"Playfair Display\", serif" },
  { id: "jetbrains",    label: "JetBrains Mono", css: "\"JetBrains Mono\", monospace" },
  { id: "roboto",       label: "Roboto",       css: "Roboto, sans-serif" },
];

export function fontFamilyCss(id) {
  return FONT_FAMILIES.find(f => f.id === id)?.css || id;
}

export function buildFontString(layer) {
  const weight = layer.fontWeight || 400;
  const italic = layer.italic ? "italic " : "";
  const size = layer.fontSize || 48;
  const family = fontFamilyCss(layer.fontFamily) || layer.fontFamily;
  return `${italic}${weight} ${size}px ${family}`;
}

function wrapLines(ctx, layer) {
  const lines = String(layer.text || "").split(/\n/);
  if (!layer.maxWidth || layer.maxWidth <= 0) return lines;
  const wrapped = [];
  for (const raw of lines) {
    const words = raw.split(/(\s+)/);
    let current = "";
    for (const w of words) {
      const candidate = current + w;
      const { width } = ctx.measureText(candidate);
      if (width <= layer.maxWidth || current === "") {
        current = candidate;
      } else {
        wrapped.push(current.trimEnd());
        current = w.trimStart();
      }
    }
    wrapped.push(current);
  }
  return wrapped;
}

export function measureText(ctx, layer) {
  ctx.save();
  ctx.font = buildFontString(layer);
  ctx.textBaseline = "top";
  const lines = wrapLines(ctx, layer);
  let maxWidth = 0;
  for (const line of lines) {
    const { width } = ctx.measureText(line);
    if (width > maxWidth) maxWidth = width;
  }
  const lineHeight = (layer.fontSize || 48) * 1.2;
  const height = lines.length * lineHeight;
  ctx.restore();
  return { lines, width: maxWidth, height, lineHeight };
}

export function drawText(ctx, layer) {
  ctx.save();
  ctx.font = buildFontString(layer);
  ctx.textBaseline = "top";
  ctx.fillStyle = layer.color || "#000";
  ctx.textAlign = layer.align || "left";
  const { lines, width, lineHeight } = measureText(ctx, layer);
  // When textAlign is right/center we offset the x anchor accordingly inside the bounding box.
  const originX = layer.align === "center" ? width / 2 : layer.align === "right" ? width : 0;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], originX, i * lineHeight);
  }
  ctx.restore();
}

export function getTextBounds(ctx, layer) {
  const { width, height } = measureText(ctx, layer);
  const left = layer.ox || 0;
  const top = layer.oy || 0;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

export function hitText(ctx, layer, px, py) {
  const b = getTextBounds(ctx, layer);
  return px >= b.left && px <= b.right && py >= b.top && py <= b.bottom;
}

export function drawTextSelection(ctx, layer, zoom, textCtx) {
  const { width, height } = measureText(textCtx, layer);
  ctx.save();
  ctx.strokeStyle = "rgba(25,77,111,0.95)";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeRect(0, 0, Math.max(width, 1), Math.max(height, 1));
  ctx.setLineDash([]);
  ctx.restore();
}
