import { dist, lerp } from "./utils.js";

export const BRUSH_PRESETS = [
  { id: "soft",   label: "Soft",   symbol: "◯", spacing: 0.15, effectiveRadiusMul: 0.5 },
  { id: "pencil", label: "Pencil", symbol: "✎", spacing: 0.5,  effectiveRadiusMul: 0.5 },
  { id: "spray",  label: "Spray",  symbol: "◌", spacing: 0.25, effectiveRadiusMul: 0.5 },
  { id: "marker", label: "Marker", symbol: "▬", spacing: 0.3,  effectiveRadiusMul: 0.55 },
];

export function getPreset(id) {
  return BRUSH_PRESETS.find(p => p.id === id) || BRUSH_PRESETS[0];
}

function stampSoft(ctx, x, y, size, color, opacity, erase) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.fillStyle = erase ? "rgba(0,0,0,1)" : color;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function stampPencil(ctx, x, y, size, color, _opacity, erase) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.fillStyle = erase ? "rgba(0,0,0,1)" : color;
  ctx.imageSmoothingEnabled = false;
  const radius = Math.max(0.5, size / 2);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function stampSpray(ctx, x, y, size, color, opacity, erase) {
  const radius = size / 2;
  const dotCount = Math.max(1, Math.round(size * 0.3));
  ctx.save();
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.fillStyle = erase ? "rgba(0,0,0,1)" : color;
  for (let i = 0; i < dotCount; i += 1) {
    // uniform disc sampling via sqrt of r
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const dx = Math.cos(theta) * r;
    const dy = Math.sin(theta) * r;
    ctx.globalAlpha = opacity * (0.3 + Math.random() * 0.7);
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function stampMarker(ctx, x, y, size, color, opacity, erase) {
  const radius = size / 2;
  const wide = radius * 1.1;
  const tall = radius * 0.55;
  ctx.save();
  ctx.globalAlpha = opacity * 0.5;
  ctx.globalCompositeOperation = erase ? "destination-out" : "multiply";
  ctx.fillStyle = erase ? "rgba(0,0,0,1)" : color;
  const offsets = [-tall * 0.25, 0, tall * 0.25];
  for (let i = 0; i < offsets.length; i += 1) {
    ctx.beginPath();
    ctx.ellipse(x, y + offsets[i], wide, tall, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const STAMPERS = {
  soft: stampSoft,
  pencil: stampPencil,
  spray: stampSpray,
  marker: stampMarker,
};

export function stampBrush(ctx, presetId, x, y, size, color, opacity, erase) {
  (STAMPERS[presetId] || stampSoft)(ctx, x, y, size, color, opacity, erase);
}

export function drawBrushSegment(ctx, presetId, x0, y0, x1, y1, size, color, opacity, erase) {
  const preset = getPreset(presetId);
  const distance = dist(x0, y0, x1, y1);
  const step = Math.max(0.5, size * preset.spacing);
  const steps = Math.max(1, Math.ceil(distance / step));
  const stamp = STAMPERS[presetId] || stampSoft;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    stamp(ctx, lerp(x0, x1, t), lerp(y0, y1, t), size, color, opacity, erase);
  }
}

// Effective radius used to grow strokeBounds — marker is slightly wider than size/2.
export function getEffectiveRadius(presetId, size) {
  const preset = getPreset(presetId);
  return size * preset.effectiveRadiusMul;
}
