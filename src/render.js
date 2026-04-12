import { CHECKER, DEFAULT_PRIMARY } from "./constants.js";
import { drawShape, getShapeBounds, getShapeHandles } from "./shapes.js";
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
  if (shape.type === "line") {
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
  tool,
  brushSize,
  screenPoint,
  isPanning,
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

  for (const id of editorDoc.order) {
    const layer = editorDoc.layers[id];
    if (!layer || !layer.visible) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blend;
    ctx.translate(layer.ox, layer.oy);
    if (layer.type === "raster") ctx.drawImage(layer.canvas, 0, 0);
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
