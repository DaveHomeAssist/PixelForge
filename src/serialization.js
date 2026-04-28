import { DEFAULT_W, DEFAULT_H, DEFAULT_BG } from "./constants.js";
import { uid, makeCanvas, cloneShapes } from "./utils.js";

export function createDefaultDocument(w, h, bgColor = DEFAULT_BG) {
  const bg = {
    id: uid(),
    name: "Background",
    type: "raster",
    visible: true,
    opacity: 1,
    blend: "source-over",
    locked: false,
    contentHint: "background",
    canvas: makeCanvas(w, h),
    ox: 0,
    oy: 0,
  };
  const bgCtx = bg.canvas.getContext("2d");
  bgCtx.fillStyle = bgColor;
  bgCtx.fillRect(0, 0, w, h);
  const vec = {
    id: uid(),
    name: "Shapes",
    type: "vector",
    visible: true,
    opacity: 1,
    blend: "source-over",
    locked: false,
    shapes: [],
    ox: 0,
    oy: 0,
  };
  return { doc: { layers: { [bg.id]: bg, [vec.id]: vec }, order: [bg.id, vec.id] }, activeId: bg.id };
}

export function serializeLayer(layer) {
  const base = {
    id: layer.id,
    name: layer.name,
    type: layer.type,
    visible: layer.visible,
    opacity: layer.opacity,
    blend: layer.blend,
    locked: !!layer.locked,
    ox: layer.ox,
    oy: layer.oy,
    effect: layer.effect || null,
    maskEnabled: !!layer.maskEnabled,
    clipToBelow: !!layer.clipToBelow,
  };
  if (layer.type === "raster") {
    return { ...base, contentHint: layer.contentHint || "edited", data: layer.canvas.toDataURL("image/png") };
  }
  if (layer.type === "text") {
    return {
      ...base,
      text: layer.text,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      italic: !!layer.italic,
      color: layer.color,
      align: layer.align,
      maxWidth: layer.maxWidth,
    };
  }
  return { ...base, shapes: cloneShapes(layer.shapes) };
}

export function buildProjectPayload(editorDoc, docW, docH, activeId, selectedShape) {
  return {
    v: 3,
    w: docW,
    h: docH,
    aid: activeId,
    selectedShape,
    layers: editorDoc.order.map(id => serializeLayer(editorDoc.layers[id])),
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("Failed to serialize canvas"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function buildDraftPayload(editorDoc, docW, docH, activeId, selectedShape) {
  const layers = await Promise.all(editorDoc.order.map(async id => {
    const layer = editorDoc.layers[id];
    if (!layer) return null;
    if (layer.type !== "raster") return serializeLayer(layer);
    return {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      visible: layer.visible,
      opacity: layer.opacity,
      blend: layer.blend,
      locked: !!layer.locked,
      ox: layer.ox,
      oy: layer.oy,
      contentHint: layer.contentHint || "edited",
      blob: await canvasToBlob(layer.canvas),
    };
  }));
  return {
    v: 3,
    w: docW,
    h: docH,
    aid: activeId,
    selectedShape,
    layers: layers.filter(Boolean),
  };
}

export async function hydrateProject(data) {
  if (!data || !data.layers || (data.v !== 1 && data.v !== 2 && data.v !== 3)) throw new Error("Bad format");
  const width = data.w || DEFAULT_W;
  const height = data.h || DEFAULT_H;
  const nextDoc = { layers: {}, order: [] };

  for (const rawLayer of data.layers) {
    if (rawLayer.type === "raster") {
      const layer = {
        id: rawLayer.id || uid(),
        name: rawLayer.name || "Raster",
        type: "raster",
        visible: rawLayer.visible !== false,
        opacity: rawLayer.opacity ?? 1,
        blend: rawLayer.blend || "source-over",
        locked: !!rawLayer.locked,
        contentHint: rawLayer.contentHint || (rawLayer.name === "Background" ? "background" : "edited"),
        effect: rawLayer.effect || null,
        maskEnabled: !!rawLayer.maskEnabled,
        clipToBelow: !!rawLayer.clipToBelow,
        canvas: makeCanvas(width, height),
        ox: rawLayer.ox || 0,
        oy: rawLayer.oy || 0,
      };
      if (rawLayer.data) {
        const img = new window.Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = rawLayer.data;
        });
        layer.canvas.getContext("2d").drawImage(img, 0, 0);
      }
      nextDoc.layers[layer.id] = layer;
      nextDoc.order.push(layer.id);
      continue;
    }

    if (rawLayer.type === "text") {
      const layer = {
        id: rawLayer.id || uid(),
        name: rawLayer.name || "Text",
        type: "text",
        visible: rawLayer.visible !== false,
        opacity: rawLayer.opacity ?? 1,
        blend: rawLayer.blend || "source-over",
        locked: !!rawLayer.locked,
        effect: rawLayer.effect || null,
        maskEnabled: !!rawLayer.maskEnabled,
        clipToBelow: !!rawLayer.clipToBelow,
        ox: rawLayer.ox || 0,
        oy: rawLayer.oy || 0,
        text: rawLayer.text ?? "",
        fontFamily: rawLayer.fontFamily || "Inter, -apple-system, sans-serif",
        fontSize: rawLayer.fontSize || 48,
        fontWeight: rawLayer.fontWeight || 400,
        italic: !!rawLayer.italic,
        color: rawLayer.color || "#1b2a33",
        align: rawLayer.align || "left",
        maxWidth: rawLayer.maxWidth ?? null,
      };
      nextDoc.layers[layer.id] = layer;
      nextDoc.order.push(layer.id);
      continue;
    }

    const layer = {
      id: rawLayer.id || uid(),
      name: rawLayer.name || "Vector",
      type: "vector",
      visible: rawLayer.visible !== false,
      opacity: rawLayer.opacity ?? 1,
      blend: rawLayer.blend || "source-over",
      locked: !!rawLayer.locked,
      effect: rawLayer.effect || null,
      maskEnabled: !!rawLayer.maskEnabled,
      clipToBelow: !!rawLayer.clipToBelow,
      shapes: cloneShapes(rawLayer.shapes || []),
      ox: rawLayer.ox || 0,
      oy: rawLayer.oy || 0,
    };
    nextDoc.layers[layer.id] = layer;
    nextDoc.order.push(layer.id);
  }

  return {
    doc: nextDoc,
    docW: width,
    docH: height,
    activeId: data.aid && nextDoc.layers[data.aid] ? data.aid : nextDoc.order[0],
    selectedShape: data.selectedShape || null,
  };
}

export async function hydrateDraftPayload(data) {
  if (!data?.layers?.length) throw new Error("Bad format");
  const nextData = {
    ...data,
    layers: await Promise.all(data.layers.map(async layer => {
      if (layer.type !== "raster" || !layer.blob) return layer;
      return {
        ...layer,
        data: await blobToDataURL(layer.blob),
      };
    })),
  };
  return hydrateProject(nextData);
}

export function captureLayerSnapshot(layer) {
  if (!layer) return null;
  if (layer.type === "raster") {
    return {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      visible: layer.visible,
      opacity: layer.opacity,
      blend: layer.blend,
      locked: !!layer.locked,
      contentHint: layer.contentHint || "edited",
      effect: layer.effect || null,
      maskEnabled: !!layer.maskEnabled,
      clipToBelow: !!layer.clipToBelow,
      ox: layer.ox,
      oy: layer.oy,
      imageData: layer.canvas.getContext("2d").getImageData(0, 0, layer.canvas.width, layer.canvas.height),
    };
  }
  if (layer.type === "text") {
    return {
      id: layer.id,
      name: layer.name,
      type: "text",
      visible: layer.visible,
      opacity: layer.opacity,
      blend: layer.blend,
      locked: !!layer.locked,
      effect: layer.effect || null,
      maskEnabled: !!layer.maskEnabled,
      clipToBelow: !!layer.clipToBelow,
      ox: layer.ox,
      oy: layer.oy,
      text: layer.text,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      italic: !!layer.italic,
      color: layer.color,
      align: layer.align,
      maxWidth: layer.maxWidth,
    };
  }
  return {
    id: layer.id,
    name: layer.name,
    type: layer.type,
    visible: layer.visible,
    opacity: layer.opacity,
    blend: layer.blend,
    locked: !!layer.locked,
    effect: layer.effect || null,
    maskEnabled: !!layer.maskEnabled,
    clipToBelow: !!layer.clipToBelow,
    ox: layer.ox,
    oy: layer.oy,
    shapes: cloneShapes(layer.shapes),
  };
}

export function restoreLayerSnapshot(layerSnapshot, width, height) {
  if (layerSnapshot.type === "raster") {
    const canvas = makeCanvas(width, height);
    canvas.getContext("2d").putImageData(layerSnapshot.imageData, 0, 0);
    return {
      id: layerSnapshot.id,
      name: layerSnapshot.name,
      type: "raster",
      visible: layerSnapshot.visible,
      opacity: layerSnapshot.opacity,
      blend: layerSnapshot.blend,
      locked: !!layerSnapshot.locked,
      contentHint: layerSnapshot.contentHint || "edited",
      effect: layerSnapshot.effect || null,
      maskEnabled: !!layerSnapshot.maskEnabled,
      clipToBelow: !!layerSnapshot.clipToBelow,
      canvas,
      ox: layerSnapshot.ox,
      oy: layerSnapshot.oy,
    };
  }
  if (layerSnapshot.type === "text") {
    return {
      id: layerSnapshot.id,
      name: layerSnapshot.name,
      type: "text",
      visible: layerSnapshot.visible,
      opacity: layerSnapshot.opacity,
      blend: layerSnapshot.blend,
      locked: !!layerSnapshot.locked,
      effect: layerSnapshot.effect || null,
      maskEnabled: !!layerSnapshot.maskEnabled,
      clipToBelow: !!layerSnapshot.clipToBelow,
      ox: layerSnapshot.ox,
      oy: layerSnapshot.oy,
      text: layerSnapshot.text,
      fontFamily: layerSnapshot.fontFamily,
      fontSize: layerSnapshot.fontSize,
      fontWeight: layerSnapshot.fontWeight,
      italic: !!layerSnapshot.italic,
      color: layerSnapshot.color,
      align: layerSnapshot.align,
      maxWidth: layerSnapshot.maxWidth,
    };
  }
  return {
    id: layerSnapshot.id,
    name: layerSnapshot.name,
    type: "vector",
    visible: layerSnapshot.visible,
    opacity: layerSnapshot.opacity,
    blend: layerSnapshot.blend,
    locked: !!layerSnapshot.locked,
    effect: layerSnapshot.effect || null,
    maskEnabled: !!layerSnapshot.maskEnabled,
    clipToBelow: !!layerSnapshot.clipToBelow,
    shapes: cloneShapes(layerSnapshot.shapes),
    ox: layerSnapshot.ox,
    oy: layerSnapshot.oy,
  };
}
