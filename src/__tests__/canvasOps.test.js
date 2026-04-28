import { describe, expect, it } from "vitest";
import { cropToRect, rotateCanvas, trimTransparent } from "../canvasOps.js";
import { makeCanvas } from "../utils.js";

function makeDoc() {
  const canvas = makeCanvas(4, 4);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(1, 1, 2, 2);
  return {
    order: ["r", "v"],
    layers: {
      r: { id: "r", type: "raster", visible: true, opacity: 1, blend: "source-over", ox: 0, oy: 0, canvas },
      v: { id: "v", type: "vector", visible: true, opacity: 1, blend: "source-over", ox: 0, oy: 0, shapes: [{ id: "s", type: "rect", x: 1, y: 2, w: 2, h: 1, fill: "#000" }] },
    },
  };
}

describe("canvasOps", () => {
  it("cropToRect shrinks the document and shifts shapes", () => {
    const doc = makeDoc();
    const result = cropToRect(doc, 4, 4, { x: 1, y: 1, w: 2, h: 2 });

    expect(result).toEqual({ docW: 2, docH: 2 });
    expect(doc.layers.v.shapes[0].x).toBe(0);
    expect(doc.layers.v.shapes[0].y).toBe(1);
  });

  it("trimTransparent removes blank raster borders", () => {
    const doc = makeDoc();
    const result = trimTransparent(doc, 4, 4);

    expect(result).toEqual({ docW: 2, docH: 2 });
  });

  it("rotateCanvas 90 swaps dimensions and rotates shapes", () => {
    const doc = makeDoc();
    const result = rotateCanvas(doc, 4, 3, 90);

    expect(result).toEqual({ docW: 3, docH: 4 });
    expect(doc.layers.v.shapes[0].x).toBe(0);
    expect(doc.layers.v.shapes[0].y).toBe(1);
  });
});
