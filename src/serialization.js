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
  };
  if (layer.type === "raster") {
    return { ...base, contentHint: layer.contentHint || "edited", data: layer.canvas.toDataURL("image/png") };
  }
  return { ...base, shapes: cloneShapes(layer.shapes) };
}

export function buildProjectPayload(editorDoc, docW, docH, activeId, selectedShape) {
  return {
    v: 2,
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
    v: 2,
    w: docW,
    h: docH,
    aid: activeId,
    selectedShape,
    layers: layers.filter(Boolean),
  };
}

export async function hydrateProject(data) {
  if (!data || !data.layers || (data.v !== 1 && data.v !== 2)) throw new Error("Bad format");
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

    const layer = {
      id: rawLayer.id || uid(),
      name: rawLayer.name || "Vector",
      type: "vector",
      visible: rawLayer.visible !== false,
      opacity: rawLayer.opacity ?? 1,
      blend: rawLayer.blend || "source-over",
      locked: !!rawLayer.locked,
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
      ox: layer.ox,
      oy: layer.oy,
      imageData: layer.canvas.getContext("2d").getImageData(0, 0, layer.canvas.width, layer.canvas.height),
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
      canvas,
      ox: layerSnapshot.ox,
      oy: layerSnapshot.oy,
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
    shapes: cloneShapes(layerSnapshot.shapes),
    ox: layerSnapshot.ox,
    oy: layerSnapshot.oy,
  };
}
