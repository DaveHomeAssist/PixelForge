export function imageDataToFile(imageData, filename = "PixelForge Selection.png") {
  return new Promise((resolve) => {
    const tmp = document.createElement("canvas");
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext("2d").putImageData(imageData, 0, 0);
    tmp.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], filename, { type: "image/png" }));
    }, "image/png");
  });
}

export function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

export function readSelectionImageData(layer, selectionMask) {
  if (!selectionMask || !layer?.canvas) return null;
  const imageData = selectionMask.floating?.imageData
    ? cloneImageData(selectionMask.floating.imageData)
    : layer.canvas.getContext("2d").getImageData(
    selectionMask.rect.x,
    selectionMask.rect.y,
    selectionMask.rect.w,
    selectionMask.rect.h,
  );
  return maskSelectionImageData(imageData, selectionMask.mask);
}

export function maskSelectionImageData(imageData, mask) {
  if (!mask) return imageData;
  const next = cloneImageData(imageData);
  for (let i = 0; i < next.data.length / 4; i += 1) {
    if (mask.data[i]) continue;
    next.data[i * 4 + 3] = 0;
  }
  return next;
}

export function clearSelectionPixels(layer, selectionMask) {
  if (!layer?.canvas || !selectionMask) return;
  const ctx = layer.canvas.getContext("2d");
  const { rect, mask } = selectionMask;
  if (!mask) {
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    return;
  }
  const imageData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
  for (let i = 0; i < imageData.data.length / 4; i += 1) {
    if (!mask.data[i]) continue;
    imageData.data[i * 4 + 3] = 0;
  }
  ctx.putImageData(imageData, rect.x, rect.y);
}

export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersects = ((yi > y) !== (yj > y))
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function makePolygonSelection(points) {
  if (!points?.length) return null;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const x = Math.floor(Math.min(...xs));
  const y = Math.floor(Math.min(...ys));
  const right = Math.ceil(Math.max(...xs));
  const bottom = Math.ceil(Math.max(...ys));
  const w = Math.max(0, right - x);
  const h = Math.max(0, bottom - y);
  if (w <= 0 || h <= 0) return null;
  const data = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      if (pointInPolygon(x + xx + 0.5, y + yy + 0.5, points)) data[yy * w + xx] = 1;
    }
  }
  return { rect: { x, y, w, h }, mask: { w, h, data } };
}
