import { useCallback, useEffect } from "react";
import {
  clamp, cloneShape, dist, ensureShape, extractRegion, lerp, rgbHex,
} from "../utils.js";
import {
  applyLineHandle, applyRectResize, getShapeHandles, hitShape,
} from "../shapes.js";

function stamp(ctx, x, y, size, color, opacity, erase) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.fillStyle = erase ? "rgba(0,0,0,1)" : color;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function brushLine(ctx, x0, y0, x1, y1, size, color, opacity, erase) {
  const distance = dist(x0, y0, x1, y1);
  const step = Math.max(0.5, size * 0.15);
  const steps = Math.max(1, Math.ceil(distance / step));
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    stamp(ctx, lerp(x0, x1, t), lerp(y0, y1, t), size, color, opacity, erase);
  }
}

export default function useCanvasInteractions({
  cvRef,
  vpRef,
  tsRef,
  spaceRef,
  panningRef,
  panStateRef,
  docRef,
  activeId,
  selectedShape,
  tool,
  zoom,
  pan,
  brushSize,
  brushOpacity,
  color1,
  fillOn,
  strokeOn,
  strokeW,
  color2,
  getLayer,
  findShapeRecord,
  clearSelection,
  canEditLayer,
  capturePatchSnapshot,
  commitPatchHistory,
  pushHistory,
  syncEditor,
  setSelectedShape,
  setColor1,
  setPan,
  setZoom,
  bump,
  flash,
  triggerFeedback,
}) {
  const screenToDoc = useCallback((screenX, screenY) => {
    const rect = cvRef.current?.getBoundingClientRect();
    return rect
      ? { x: (screenX - rect.left - pan.x) / zoom, y: (screenY - rect.top - pan.y) / zoom }
      : { x: 0, y: 0 };
  }, [cvRef, pan.x, pan.y, zoom]);

  const getHandleAtPoint = useCallback((shape, pointX, pointY) => {
    const radius = Math.max(6, 10 / zoom);
    return getShapeHandles(shape).find(handle => dist(handle.x, handle.y, pointX, pointY) <= radius)?.id || null;
  }, [zoom]);

  const commitRasterStroke = useCallback((layerId) => {
    const tracker = tsRef.current;
    if (!tracker.historyBefore?.layers?.[0]?.imageData || !tracker.strokeBounds) {
      commitPatchHistory(tracker.historyBefore, [layerId]);
      return;
    }

    const layer = getLayer(layerId);
    if (!layer?.canvas) {
      commitPatchHistory(tracker.historyBefore, [layerId]);
      return;
    }

    const { strokeBounds } = tracker;
    const canvasWidth = layer.canvas.width;
    const canvasHeight = layer.canvas.height;
    const margin = 2;
    const regionX = Math.max(0, Math.floor(strokeBounds.minX) - margin);
    const regionY = Math.max(0, Math.floor(strokeBounds.minY) - margin);
    const regionX2 = Math.min(canvasWidth, Math.ceil(strokeBounds.maxX) + margin + 1);
    const regionY2 = Math.min(canvasHeight, Math.ceil(strokeBounds.maxY) + margin + 1);
    const regionW = regionX2 - regionX;
    const regionH = regionY2 - regionY;

    if (regionW <= 0 || regionH <= 0 || regionW * regionH > canvasWidth * canvasHeight * 0.5) {
      commitPatchHistory(tracker.historyBefore, [layerId]);
      return;
    }

    const region = { x: regionX, y: regionY, w: regionW, h: regionH };
    const beforeFull = tracker.historyBefore.layers[0].imageData;
    const beforeRegion = extractRegion(beforeFull, region);
    const afterRegion = layer.canvas.getContext("2d").getImageData(regionX, regionY, regionW, regionH);
    const meta = {
      id: layer.id,
      name: layer.name,
      type: "raster",
      visible: layer.visible,
      opacity: layer.opacity,
      blend: layer.blend,
      locked: !!layer.locked,
      contentHint: layer.contentHint || "edited",
      ox: layer.ox,
      oy: layer.oy,
    };
    const before = { mode: "patch", layers: [{ ...meta, region, imageData: beforeRegion }] };
    const after = { mode: "patch", layers: [{ ...meta, region, imageData: afterRegion }], activeId, selectedShape };
    pushHistory(before, after);
    syncEditor();
  }, [activeId, commitPatchHistory, getLayer, pushHistory, selectedShape, syncEditor, tsRef]);

  const onDown = useCallback((event) => {
    event.preventDefault();
    const rect = cvRef.current?.getBoundingClientRect();
    if (rect) {
      tsRef.current.scrX = event.clientX - rect.left;
      tsRef.current.scrY = event.clientY - rect.top;
    }

    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      panningRef.current = true;
      panStateRef.current = { x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y };
      return;
    }
    if (event.button !== 0) return;

    const point = screenToDoc(event.clientX, event.clientY);
    const tracker = tsRef.current;
    tracker.down = true;
    tracker.sx = point.x;
    tracker.sy = point.y;
    tracker.lx = point.x;
    tracker.ly = point.y;
    tracker.preview = null;
    tracker.drag = null;
    tracker.historyBefore = null;
    tracker.selectionHandle = null;
    tracker.startShape = null;
    tracker.moved = false;
    tracker.strokeBounds = null;

    const layer = docRef.current.layers[activeId];
    if (!layer) return;

    if (tool === "brush" || tool === "eraser") {
      if (!canEditLayer(layer, tool)) {
        tracker.down = false;
        return;
      }
      if (layer.type !== "raster") {
        triggerFeedback(`tool-${tool}`, "error");
        flash("Select a raster layer for " + tool, "error");
        tracker.down = false;
        return;
      }
      const ctx = layer.canvas.getContext("2d");
      tracker.historyBefore = capturePatchSnapshot([layer.id]);
      layer.contentHint = "edited";
      const startX = point.x - layer.ox;
      const startY = point.y - layer.oy;
      const halfBrush = brushSize / 2;
      tracker.strokeBounds = {
        minX: startX - halfBrush,
        minY: startY - halfBrush,
        maxX: startX + halfBrush,
        maxY: startY + halfBrush,
      };
      stamp(ctx, startX, startY, brushSize, color1, brushOpacity, tool === "eraser");
      bump();
      return;
    }

    if (tool === "move") {
      if (layer.type === "vector") {
        const selectedRecord = findShapeRecord();
        if (selectedRecord?.layer.id === layer.id) {
          const handle = getHandleAtPoint(selectedRecord.shape, point.x - layer.ox, point.y - layer.oy);
          if (handle) {
            if (!canEditLayer(layer, "transform shapes")) {
              tracker.down = false;
              return;
            }
            tracker.selectionHandle = handle;
            tracker.drag = { shapeId: selectedRecord.shape.id };
            tracker.startShape = cloneShape(selectedRecord.shape);
            tracker.historyBefore = capturePatchSnapshot([layer.id], true);
            return;
          }
        }

        for (let index = layer.shapes.length - 1; index >= 0; index -= 1) {
          if (!hitShape(layer.shapes[index], point.x - layer.ox, point.y - layer.oy)) continue;
          const shape = layer.shapes[index];
          const nextSelection = { layerId: layer.id, shapeId: shape.id };
          setSelectedShape(nextSelection);
          if (layer.locked) {
            tracker.down = false;
            return;
          }
          tracker.drag = { shapeId: shape.id };
          tracker.startShape = cloneShape(shape);
          tracker.historyBefore = capturePatchSnapshot([layer.id], true, { selectedShape: nextSelection });
          break;
        }

        if (!tracker.drag && !tracker.selectionHandle) clearSelection();
      }

      if (!tracker.drag && !tracker.selectionHandle) {
        if (!canEditLayer(layer, "move this layer")) {
          tracker.down = false;
          return;
        }
        tracker.savedOx = layer.ox;
        tracker.savedOy = layer.oy;
        tracker.historyBefore = capturePatchSnapshot([layer.id], true);
      }
      return;
    }

    if (["rect", "ellipse", "line"].includes(tool)) {
      if (!canEditLayer(layer, "draw shapes")) {
        tracker.down = false;
        return;
      }
      if (layer.type !== "vector") {
        triggerFeedback(`tool-${tool}`, "error");
        flash("Select a vector layer for shapes", "error");
        tracker.down = false;
        return;
      }
      clearSelection();
      tracker.historyBefore = capturePatchSnapshot([layer.id], true, { selectedShape: null });
      return;
    }

    if (tool === "eyedropper") {
      tracker.down = false;
      const canvas = cvRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const canvasRect = canvas.getBoundingClientRect();
      const pixelX = (event.clientX - canvasRect.left) * dpr;
      const pixelY = (event.clientY - canvasRect.top) * dpr;
      const data = canvas.getContext("2d").getImageData(pixelX, pixelY, 1, 1).data;
      if (data[3] <= 0) return;
      const hex = rgbHex(data[0], data[1], data[2]);
      setColor1(hex);
      triggerFeedback("color-primary", "success", 140);
      flash("Picked " + hex, "success", 1200);
    }
  }, [
    activeId,
    brushOpacity,
    brushSize,
    bump,
    canEditLayer,
    capturePatchSnapshot,
    clearSelection,
    color1,
    cvRef,
    docRef,
    findShapeRecord,
    flash,
    getHandleAtPoint,
    pan.x,
    pan.y,
    panStateRef,
    panningRef,
    screenToDoc,
    setColor1,
    setSelectedShape,
    spaceRef,
    tool,
    triggerFeedback,
    tsRef,
  ]);

  const onMove = useCallback((event) => {
    const rect = cvRef.current?.getBoundingClientRect();
    if (rect) {
      tsRef.current.scrX = event.clientX - rect.left;
      tsRef.current.scrY = event.clientY - rect.top;
    }

    if (panningRef.current) {
      setPan({
        x: panStateRef.current.ox + event.clientX - panStateRef.current.x,
        y: panStateRef.current.oy + event.clientY - panStateRef.current.y,
      });
      return;
    }

    if (!tsRef.current.down) {
      if (["brush", "eraser"].includes(tool)) bump();
      return;
    }

    const point = screenToDoc(event.clientX, event.clientY);
    const tracker = tsRef.current;
    const layer = docRef.current.layers[activeId];
    if (!layer) return;

    if (tool === "brush" || tool === "eraser") {
      if (layer.type === "raster") {
        const x0 = tracker.lx - layer.ox;
        const y0 = tracker.ly - layer.oy;
        const x1 = point.x - layer.ox;
        const y1 = point.y - layer.oy;
        brushLine(layer.canvas.getContext("2d"), x0, y0, x1, y1, brushSize, color1, brushOpacity, tool === "eraser");
        if (tracker.strokeBounds) {
          const halfBrush = brushSize / 2;
          tracker.strokeBounds.minX = Math.min(tracker.strokeBounds.minX, x0 - halfBrush, x1 - halfBrush);
          tracker.strokeBounds.minY = Math.min(tracker.strokeBounds.minY, y0 - halfBrush, y1 - halfBrush);
          tracker.strokeBounds.maxX = Math.max(tracker.strokeBounds.maxX, x0 + halfBrush, x1 + halfBrush);
          tracker.strokeBounds.maxY = Math.max(tracker.strokeBounds.maxY, y0 + halfBrush, y1 + halfBrush);
        }
        tracker.moved = true;
        bump();
      }
    } else if (tool === "move") {
      const dx = point.x - tracker.sx;
      const dy = point.y - tracker.sy;
      if (dx || dy) tracker.moved = true;
      if (layer.type === "vector" && tracker.drag?.shapeId) {
        const record = findShapeRecord({ layerId: layer.id, shapeId: tracker.drag.shapeId });
        if (!record || !tracker.startShape) return;
        if (tracker.selectionHandle) {
          if (record.shape.type === "line") applyLineHandle(record.shape, tracker.selectionHandle, tracker.startShape, dx, dy);
          else applyRectResize(record.shape, tracker.selectionHandle, tracker.startShape, dx, dy);
        } else if (record.shape.type === "line") {
          record.shape.x1 = tracker.startShape.x1 + dx;
          record.shape.y1 = tracker.startShape.y1 + dy;
          record.shape.x2 = tracker.startShape.x2 + dx;
          record.shape.y2 = tracker.startShape.y2 + dy;
        } else {
          record.shape.x = tracker.startShape.x + dx;
          record.shape.y = tracker.startShape.y + dy;
        }
      } else {
        layer.ox = tracker.savedOx + dx;
        layer.oy = tracker.savedOy + dy;
      }
      bump();
    } else if (["rect", "ellipse"].includes(tool)) {
      tracker.preview = {
        type: tool,
        x: Math.min(tracker.sx, point.x) - layer.ox,
        y: Math.min(tracker.sy, point.y) - layer.oy,
        w: Math.abs(point.x - tracker.sx),
        h: Math.abs(point.y - tracker.sy),
        fill: fillOn ? color1 : null,
        stroke: strokeOn ? color2 : null,
        strokeWidth: strokeW,
      };
      tracker.moved = true;
      bump();
    } else if (tool === "line") {
      tracker.preview = {
        type: "line",
        x1: tracker.sx - layer.ox,
        y1: tracker.sy - layer.oy,
        x2: point.x - layer.ox,
        y2: point.y - layer.oy,
        stroke: color1,
        strokeWidth: strokeW,
      };
      tracker.moved = true;
      bump();
    }

    tracker.lx = point.x;
    tracker.ly = point.y;
  }, [
    activeId,
    brushOpacity,
    brushSize,
    bump,
    color1,
    color2,
    cvRef,
    docRef,
    fillOn,
    findShapeRecord,
    panStateRef,
    panningRef,
    screenToDoc,
    setPan,
    strokeOn,
    strokeW,
    tool,
    tsRef,
  ]);

  const onUp = useCallback(() => {
    if (panningRef.current) {
      panningRef.current = false;
      return;
    }
    const tracker = tsRef.current;
    if (!tracker.down) return;
    tracker.down = false;
    const layer = docRef.current.layers[activeId];

    if ((tool === "brush" || tool === "eraser") && layer?.type === "raster" && tracker.historyBefore) {
      commitRasterStroke(layer.id);
    } else if (["rect", "ellipse", "line"].includes(tool) && layer?.type === "vector" && tracker.preview) {
      const shape = ensureShape({ ...tracker.preview });
      layer.shapes.push(shape);
      const nextSelection = { layerId: layer.id, shapeId: shape.id };
      setSelectedShape(nextSelection);
      commitPatchHistory(tracker.historyBefore, [layer.id], { selectedShape: nextSelection });
      tracker.preview = null;
    } else if (tool === "move" && layer && tracker.historyBefore && tracker.moved) {
      commitPatchHistory(
        tracker.historyBefore,
        [layer.id],
        { selectedShape: tracker.drag?.shapeId ? { layerId: layer.id, shapeId: tracker.drag.shapeId } : selectedShape },
      );
    }

    tracker.drag = null;
    tracker.selectionHandle = null;
    tracker.startShape = null;
    tracker.historyBefore = null;
    tracker.moved = false;
    tracker.strokeBounds = null;
    bump();
  }, [
    activeId,
    bump,
    commitPatchHistory,
    commitRasterStroke,
    docRef,
    panningRef,
    selectedShape,
    setSelectedShape,
    tool,
    tsRef,
  ]);

  useEffect(() => {
    const viewport = vpRef.current;
    if (!viewport) return undefined;

    const handler = (event) => {
      event.preventDefault();
      const rect = cvRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      setZoom(previousZoom => {
        const nextZoom = clamp(previousZoom * factor, 0.02, 64);
        const ratio = nextZoom / previousZoom;
        setPan(previousPan => ({
          x: mouseX - ratio * (mouseX - previousPan.x),
          y: mouseY - ratio * (mouseY - previousPan.y),
        }));
        return nextZoom;
      });
    };

    viewport.addEventListener("wheel", handler, { passive: false });
    return () => viewport.removeEventListener("wheel", handler);
  }, [cvRef, setPan, setZoom, vpRef]);

  return {
    getHandleAtPoint,
    onDown,
    onMove,
    onUp,
  };
}
