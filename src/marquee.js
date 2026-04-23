import { makeCanvas } from "./utils.js";

export function normalizeRect(rect) {
  const x = Math.round(Math.min(rect.x, rect.x + rect.w));
  const y = Math.round(Math.min(rect.y, rect.y + rect.h));
  const w = Math.abs(Math.round(rect.w));
  const h = Math.abs(Math.round(rect.h));
  return { x, y, w, h };
}

export function clipRectToLayer(rect, layer) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(layer.canvas.width, rect.x + rect.w);
  const y1 = Math.min(layer.canvas.height, rect.y + rect.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export function pointInRect(p, rect) {
  return p.x >= rect.x && p.x <= rect.x + rect.w
      && p.y >= rect.y && p.y <= rect.y + rect.h;
}

export function liftSelection(layer, rect) {
  const ctx = layer.canvas.getContext("2d");
  const imageData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
  ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
  return { imageData, ox: 0, oy: 0 };
}

export function commitFloat(layer, rect, floating) {
  if (!floating) return;
  // Use a temp canvas + drawImage so transparent pixels composite correctly.
  const temp = makeCanvas(rect.w, rect.h);
  temp.getContext("2d").putImageData(floating.imageData, 0, 0);
  const ctx = layer.canvas.getContext("2d");
  ctx.drawImage(temp, rect.x + floating.ox, rect.y + floating.oy);
}
