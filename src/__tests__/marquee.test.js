import { describe, expect, it } from "vitest";
import {
  normalizeRect,
  clipRectToLayer,
  pointInRect,
  liftSelection,
  commitFloat,
} from "../marquee.js";
import { makeCanvas } from "../utils.js";

function makeRasterLayer(w = 100, h = 100) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, w, h);
  return { id: "L1", type: "raster", ox: 0, oy: 0, canvas };
}

function readPixel(layer, x, y) {
  const d = layer.canvas.getContext("2d").getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

describe("normalizeRect", () => {
  it("normalizes negative width/height", () => {
    expect(normalizeRect({ x: 20, y: 30, w: -10, h: -8 })).toEqual({ x: 10, y: 22, w: 10, h: 8 });
  });
});

describe("clipRectToLayer", () => {
  it("clamps rect to layer bounds", () => {
    const layer = makeRasterLayer(100, 100);
    expect(clipRectToLayer({ x: -5, y: -5, w: 20, h: 20 }, layer)).toEqual({ x: 0, y: 0, w: 15, h: 15 });
    expect(clipRectToLayer({ x: 90, y: 90, w: 30, h: 30 }, layer)).toEqual({ x: 90, y: 90, w: 10, h: 10 });
  });

  it("zero-area when fully outside", () => {
    const layer = makeRasterLayer(100, 100);
    const r = clipRectToLayer({ x: 200, y: 200, w: 10, h: 10 }, layer);
    expect(r.w).toBe(0);
    expect(r.h).toBe(0);
  });
});

describe("pointInRect", () => {
  it("returns true inside, false outside", () => {
    const r = { x: 10, y: 10, w: 20, h: 20 };
    expect(pointInRect({ x: 15, y: 15 }, r)).toBe(true);
    expect(pointInRect({ x: 5, y: 5 }, r)).toBe(false);
    expect(pointInRect({ x: 30, y: 30 }, r)).toBe(true); // edge
  });
});

describe("liftSelection", () => {
  it("moves pixels out of the layer and into a float buffer", () => {
    const layer = makeRasterLayer(40, 40);
    expect(readPixel(layer, 10, 10).a).toBe(255);
    const float = liftSelection(layer, { x: 5, y: 5, w: 10, h: 10 });
    expect(float.imageData.width).toBe(10);
    expect(float.imageData.height).toBe(10);
    // Pixels inside the lifted region are cleared
    expect(readPixel(layer, 10, 10).a).toBe(0);
    // Pixels outside are still filled
    expect(readPixel(layer, 20, 20).a).toBe(255);
  });
});

describe("commitFloat", () => {
  it("writes the float back to the layer at an offset", () => {
    const layer = makeRasterLayer(40, 40);
    const float = liftSelection(layer, { x: 5, y: 5, w: 10, h: 10 });
    // Before commit — the source region is clear
    expect(readPixel(layer, 10, 10).a).toBe(0);
    commitFloat(layer, { x: 5, y: 5, w: 10, h: 10 }, { imageData: float.imageData, ox: 20, oy: 0 });
    // Now the float landed at (25, 5)..(35, 15)
    expect(readPixel(layer, 28, 10).a).toBe(255);
  });

  it("no-op when floating is null", () => {
    const layer = makeRasterLayer(40, 40);
    expect(() => commitFloat(layer, { x: 0, y: 0, w: 10, h: 10 }, null)).not.toThrow();
  });
});
