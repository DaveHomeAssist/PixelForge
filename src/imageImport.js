import { uid, makeCanvas } from "./utils.js";

async function toDrawable(source) {
  if (typeof source === "string") {
    const image = new window.Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = source;
    });
    return { drawable: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, cleanup: null };
  }
  if (source instanceof Blob) {
    const url = URL.createObjectURL(source);
    try {
      const image = new window.Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      return {
        drawable: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        cleanup: () => URL.revokeObjectURL(url),
      };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }
  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) {
    return { drawable: source, width: source.width, height: source.height, cleanup: null };
  }
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { drawable: source, width: source.width, height: source.height, cleanup: null };
  }
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    if (!source.complete) {
      await new Promise((resolve, reject) => {
        source.onload = resolve;
        source.onerror = reject;
      });
    }
    return { drawable: source, width: source.naturalWidth || source.width, height: source.naturalHeight || source.height, cleanup: null };
  }
  throw new Error("Unsupported image source");
}

export async function createRasterLayerFromImage(imageSource, opts) {
  const {
    docRef,
    docW,
    docH,
    withFullHistory,
    setActiveId,
    setSelectedShape,
    name = "Imported Image",
    at = null,
    contentHint = "image",
  } = opts;

  const { drawable, width, height, cleanup } = await toDrawable(imageSource);

  try {
    let newLayerId = null;
    withFullHistory(() => {
      const scale = Math.min(docW / width, docH / height, 1);
      const drawW = Math.max(1, Math.round(width * scale));
      const drawH = Math.max(1, Math.round(height * scale));
      const layer = {
        id: uid(),
        name,
        type: "raster",
        visible: true,
        opacity: 1,
        blend: "source-over",
        locked: false,
        contentHint,
        canvas: makeCanvas(docW, docH),
        ox: 0,
        oy: 0,
      };
      const ctx = layer.canvas.getContext("2d");
      const drawX = at ? Math.round(at.x) : Math.round((docW - drawW) / 2);
      const drawY = at ? Math.round(at.y) : Math.round((docH - drawH) / 2);
      ctx.drawImage(drawable, drawX, drawY, drawW, drawH);
      docRef.current.layers[layer.id] = layer;
      docRef.current.order.push(layer.id);
      newLayerId = layer.id;
      setActiveId(layer.id);
      setSelectedShape(null);
      return { activeId: layer.id, selectedShape: null };
    });
    return newLayerId;
  } finally {
    if (cleanup) cleanup();
  }
}
