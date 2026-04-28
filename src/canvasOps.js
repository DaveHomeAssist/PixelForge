import { makeCanvas, cloneShape } from "./utils.js";

function shiftShape(shape, dx, dy) {
  if (shape.type === "line" || shape.type === "path") {
    shape.x1 += dx; shape.y1 += dy;
    shape.x2 += dx; shape.y2 += dy;
    return;
  }
  shape.x += dx;
  shape.y += dy;
}

function transformPoint(x, y, w, h, op) {
  if (op === "rotate90") return { x: h - y, y: x };
  if (op === "rotate-90") return { x: y, y: w - x };
  if (op === "rotate180") return { x: w - x, y: h - y };
  if (op === "flipH") return { x: w - x, y };
  if (op === "flipV") return { x, y: h - y };
  return { x, y };
}

function transformShape(source, docW, docH, op, ox = 0, oy = 0) {
  const shape = cloneShape(source);
  if (shape.type === "line" || shape.type === "path") {
    const a = transformPoint(shape.x1 + ox, shape.y1 + oy, docW, docH, op);
    const b = transformPoint(shape.x2 + ox, shape.y2 + oy, docW, docH, op);
    shape.x1 = a.x; shape.y1 = a.y;
    shape.x2 = b.x; shape.y2 = b.y;
    return shape;
  }
  const points = [
    transformPoint(shape.x + ox, shape.y + oy, docW, docH, op),
    transformPoint(shape.x + shape.w + ox, shape.y + oy, docW, docH, op),
    transformPoint(shape.x + ox, shape.y + shape.h + oy, docW, docH, op),
    transformPoint(shape.x + shape.w + ox, shape.y + shape.h + oy, docW, docH, op),
  ];
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  shape.x = Math.min(...xs);
  shape.y = Math.min(...ys);
  shape.w = Math.max(...xs) - shape.x;
  shape.h = Math.max(...ys) - shape.y;
  return shape;
}

function transformRaster(layer, docW, docH, nextW, nextH, op) {
  const source = makeCanvas(docW, docH);
  source.getContext("2d").drawImage(layer.canvas, layer.ox || 0, layer.oy || 0);
  const next = makeCanvas(nextW, nextH);
  const ctx = next.getContext("2d");
  if (op === "rotate90") {
    ctx.translate(nextW, 0);
    ctx.rotate(Math.PI / 2);
  } else if (op === "rotate-90") {
    ctx.translate(0, nextH);
    ctx.rotate(-Math.PI / 2);
  } else if (op === "rotate180") {
    ctx.translate(nextW, nextH);
    ctx.rotate(Math.PI);
  } else if (op === "flipH") {
    ctx.translate(nextW, 0);
    ctx.scale(-1, 1);
  } else if (op === "flipV") {
    ctx.translate(0, nextH);
    ctx.scale(1, -1);
  }
  ctx.drawImage(source, 0, 0);
  layer.canvas = next;
  layer.ox = 0;
  layer.oy = 0;
}

export function cropToRect(editorDoc, docW, docH, rect) {
  const crop = {
    x: Math.max(0, Math.floor(rect.x)),
    y: Math.max(0, Math.floor(rect.y)),
    w: Math.min(docW - Math.max(0, Math.floor(rect.x)), Math.max(1, Math.floor(rect.w))),
    h: Math.min(docH - Math.max(0, Math.floor(rect.y)), Math.max(1, Math.floor(rect.h))),
  };
  editorDoc.order.forEach(id => {
    const layer = editorDoc.layers[id];
    if (layer.type === "raster") {
      const next = makeCanvas(crop.w, crop.h);
      next.getContext("2d").drawImage(layer.canvas, (layer.ox || 0) - crop.x, (layer.oy || 0) - crop.y);
      layer.canvas = next;
      layer.ox = 0;
      layer.oy = 0;
      return;
    }
    if (layer.type === "vector") {
      layer.shapes.forEach(shape => shiftShape(shape, (layer.ox || 0) - crop.x, (layer.oy || 0) - crop.y));
      layer.ox = 0;
      layer.oy = 0;
      return;
    }
    layer.ox = (layer.ox || 0) - crop.x;
    layer.oy = (layer.oy || 0) - crop.y;
  });
  return { docW: crop.w, docH: crop.h };
}

export function trimTransparent(editorDoc, docW, docH) {
  let left = docW;
  let top = docH;
  let right = -1;
  let bottom = -1;
  editorDoc.order.forEach(id => {
    const layer = editorDoc.layers[id];
    if (layer?.type !== "raster" || !layer.visible) return;
    const layerW = layer.canvas.width;
    const layerH = layer.canvas.height;
    const pixels = layer.canvas.getContext("2d").getImageData(0, 0, layerW, layerH).data;
    const ox = layer.ox || 0;
    const oy = layer.oy || 0;
    for (let y = 0; y < layerH; y += 1) {
      for (let x = 0; x < layerW; x += 1) {
        if (pixels[(y * layerW + x) * 4 + 3] === 0) continue;
        const docX = x + ox;
        const docY = y + oy;
        if (docX < 0 || docY < 0 || docX >= docW || docY >= docH) continue;
        left = Math.min(left, docX);
        top = Math.min(top, docY);
        right = Math.max(right, docX + 1);
        bottom = Math.max(bottom, docY + 1);
      }
    }
  });
  if (right <= left || bottom <= top) return { docW, docH };
  return cropToRect(editorDoc, docW, docH, { x: left, y: top, w: right - left, h: bottom - top });
}

export function rotateCanvas(editorDoc, docW, docH, degrees) {
  const op = degrees === 90 ? "rotate90" : degrees === -90 ? "rotate-90" : "rotate180";
  const nextW = degrees === 180 ? docW : docH;
  const nextH = degrees === 180 ? docH : docW;
  editorDoc.order.forEach(id => {
    const layer = editorDoc.layers[id];
    if (layer.type === "raster") {
      transformRaster(layer, docW, docH, nextW, nextH, op);
    } else if (layer.type === "vector") {
      layer.shapes = layer.shapes.map(shape => transformShape(shape, docW, docH, op, layer.ox || 0, layer.oy || 0));
      layer.ox = 0;
      layer.oy = 0;
    } else {
      const point = transformPoint(layer.ox || 0, layer.oy || 0, docW, docH, op);
      layer.ox = point.x;
      layer.oy = point.y;
    }
  });
  return { docW: nextW, docH: nextH };
}

export function flipCanvas(editorDoc, docW, docH, axis) {
  const op = axis === "h" ? "flipH" : "flipV";
  editorDoc.order.forEach(id => {
    const layer = editorDoc.layers[id];
    if (layer.type === "raster") {
      transformRaster(layer, docW, docH, docW, docH, op);
    } else if (layer.type === "vector") {
      layer.shapes = layer.shapes.map(shape => transformShape(shape, docW, docH, op, layer.ox || 0, layer.oy || 0));
      layer.ox = 0;
      layer.oy = 0;
    } else {
      const point = transformPoint(layer.ox || 0, layer.oy || 0, docW, docH, op);
      layer.ox = point.x;
      layer.oy = point.y;
    }
  });
  return { docW, docH };
}
