import { CHECKER, DEFAULT_PRIMARY } from "./constants.js";
import { drawShape, getShapeBounds, getShapeHandles } from "./shapes.js";
import { drawText, drawTextSelection } from "./text.js";
import { makeCanvas } from "./utils.js";

function getCachedCanvas(cache, key, width, height, paint) {
  const existing = cache[key];
  if (existing && existing.width === width && existing.height === height) return existing.canvas;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  paint(ctx, width, height);
  cache[key] = { canvas, width, height };
  return canvas;
}

export function drawShapeSelection(ctx, layer, shape, zoom) {
  const bounds = getShapeBounds(shape);
  if (!bounds) return;
  ctx.save();
  ctx.translate(layer.ox, layer.oy);
  ctx.strokeStyle = "rgba(25,77,111,0.95)";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  if (shape.type === "line" || shape.type === "path") {
    ctx.beginPath();
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
    ctx.stroke();
  } else {
    ctx.strokeRect(bounds.left, bounds.top, Math.max(bounds.width, 1), Math.max(bounds.height, 1));
  }
  ctx.setLineDash([]);
  const handleRadius = Math.max(4 / zoom, 3);
  getShapeHandles(shape).forEach(handle => {
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, handleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

export function renderEditor({
  canvas,
  viewport,
  renderCache,
  pan,
  zoom,
  docW,
  docH,
  editorDoc,
  previewShape,
  selectedShapeRecord,
  selectedTextLayer,
  selectionMask,
  tool,
  brushSize,
  screenPoint,
  isPanning,
  workspace = {},
}) {
  if (!canvas || !viewport) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = vw * dpr;
  canvas.height = vh * dpr;
  canvas.style.width = `${vw}px`;
  canvas.style.height = `${vh}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const viewportBackground = getCachedCanvas(renderCache, "viewport", vw, vh, (bg, width, height) => {
    bg.fillStyle = "#ece4d8";
    bg.fillRect(0, 0, width, height);
    bg.fillStyle = "#d3c8b7";
    for (let y = 0; y < height; y += 24) {
      for (let x = 0; x < width; x += 24) bg.fillRect(x, y, 1, 1);
    }
  });
  ctx.drawImage(viewportBackground, 0, 0);

  ctx.save();
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  const checkerboard = getCachedCanvas(renderCache, "checker", docW, docH, (bg, width, height) => {
    for (let y = 0; y < height; y += CHECKER) {
      for (let x = 0; x < width; x += CHECKER) {
        bg.fillStyle = (Math.floor(x / CHECKER) + Math.floor(y / CHECKER)) % 2 === 0 ? "#faf7f1" : "#eee5d8";
        bg.fillRect(x, y, CHECKER, CHECKER);
      }
    }
  });
  ctx.drawImage(checkerboard, 0, 0);

  if (workspace.showGrid || workspace.pixelPreview) {
    const grid = workspace.pixelPreview && zoom >= 8 ? 1 : 64;
    ctx.save();
    ctx.strokeStyle = workspace.pixelPreview && zoom >= 8 ? "rgba(25, 77, 111, 0.24)" : "rgba(42,111,151,0.16)";
    ctx.lineWidth = 1 / zoom;
    for (let x = 0; x <= docW; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, docH);
      ctx.stroke();
    }
    for (let y = 0; y <= docH; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(docW, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const id of editorDoc.order) {
    const layer = editorDoc.layers[id];
    if (!layer || !layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.clipToBelow ? "source-atop" : layer.blend;
    if (layer.effect === "shadow") {
      ctx.shadowColor = "rgba(17, 24, 39, 0.35)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 10;
    } else if (layer.effect === "glow") {
      ctx.shadowColor = "rgba(42, 111, 151, 0.5)";
      ctx.shadowBlur = 18;
    } else if (layer.effect === "blur") {
      ctx.filter = "blur(3px)";
    }
    ctx.translate(layer.ox, layer.oy);
    if (layer.maskEnabled) {
      const mw = layer.canvas?.width || docW;
      const mh = layer.canvas?.height || docH;
      ctx.beginPath();
      ctx.rect(mw * 0.05, mh * 0.05, mw * 0.9, mh * 0.9);
      ctx.clip();
    }
    if (layer.type === "raster") ctx.drawImage(layer.canvas, 0, 0);
    else if (layer.type === "text") drawText(ctx, layer);
    else layer.shapes.forEach(shape => drawShape(ctx, shape));
    ctx.restore();
  }

  if (previewShape) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawShape(ctx, previewShape);
    ctx.restore();
  }

  if (selectedShapeRecord?.layer?.visible && selectedShapeRecord.shape) {
    drawShapeSelection(ctx, selectedShapeRecord.layer, selectedShapeRecord.shape, zoom);
  }

  if (selectedTextLayer?.visible) {
    ctx.save();
    ctx.translate(selectedTextLayer.ox, selectedTextLayer.oy);
    drawTextSelection(ctx, selectedTextLayer, zoom, ctx);
    ctx.restore();
  }

  if (selectionMask) {
    const maskLayer = editorDoc.layers[selectionMask.layerId];
    if (maskLayer) {
      const ox = maskLayer.ox || 0;
      const oy = maskLayer.oy || 0;
      const { rect, floating } = selectionMask;
      // Floating preview
      if (floating) {
        const floatCanvas = makeCanvas(rect.w, rect.h);
        floatCanvas.getContext("2d").putImageData(floating.imageData, 0, 0);
        ctx.save();
        ctx.translate(ox, oy);
        ctx.globalAlpha = maskLayer.opacity ?? 1;
        ctx.drawImage(floatCanvas, rect.x + floating.ox, rect.y + floating.oy);
        ctx.restore();
      }
      // Marching ants
      ctx.save();
      ctx.translate(ox, oy);
      ctx.lineWidth = 1 / zoom;
      const dashOn = 4 / zoom;
      const dashOff = 3 / zoom;
      const offset = (performance.now() / 60) % (dashOn + dashOff);
      ctx.setLineDash([dashOn, dashOff]);
      ctx.lineDashOffset = -offset;
      ctx.strokeStyle = "#000";
      const floatOx = floating?.ox || 0;
      const floatOy = floating?.oy || 0;
      ctx.strokeRect(rect.x + floatOx, rect.y + floatOy, rect.w, rect.h);
      ctx.lineDashOffset = -offset + (dashOn + dashOff) / 2;
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(rect.x + floatOx, rect.y + floatOy, rect.w, rect.h);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  ctx.strokeStyle = "#bfae98";
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(0, 0, docW, docH);

  const cm = 12 / zoom;
  ctx.strokeStyle = "rgba(42,111,151,0.35)";
  ctx.lineWidth = 1.5 / zoom;
  [[0, 0, cm, 0, 0, cm], [docW, 0, -cm, 0, 0, cm], [0, docH, cm, 0, 0, -cm], [docW, docH, -cm, 0, 0, -cm]].forEach(([x, y, dx1, dy1, dx2, dy2]) => {
    ctx.beginPath();
    ctx.moveTo(x + dx1, y + dy1);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx2, y + dy2);
    ctx.stroke();
  });
  ctx.restore();

  if (workspace.showRulers) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(0, 0, vw, 22);
    ctx.fillRect(0, 0, 28, vh);
    ctx.strokeStyle = "rgba(42,111,151,0.35)";
    ctx.fillStyle = "#194d6f";
    ctx.font = "10px IBM Plex Mono, monospace";
    const step = zoom >= 1 ? 100 : 250;
    for (let x = 0; x <= docW; x += step) {
      const sx = pan.x + x * zoom;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, 22);
      ctx.stroke();
      if (sx > 30 && sx < vw) ctx.fillText(String(x), sx + 3, 14);
    }
    for (let y = 0; y <= docH; y += step) {
      const sy = pan.y + y * zoom;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(28, sy);
      ctx.stroke();
      if (sy > 24 && sy < vh) ctx.fillText(String(y), 4, sy - 3);
    }
    ctx.restore();
  }

  if (["brush", "eraser"].includes(tool) && !isPanning) {
    const radius = (brushSize * zoom) / 2;
    ctx.save();
    ctx.strokeStyle = tool === "eraser" ? "rgba(208,100,69,0.72)" : "rgba(42,111,151,0.72)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, Math.max(radius, 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = tool === "eraser" ? "#d06445" : DEFAULT_PRIMARY;
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
