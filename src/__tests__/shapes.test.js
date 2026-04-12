import { describe, it, expect } from "vitest";
import {
  getShapeBounds, getShapeHandles, getResizeCursor,
  applyRectResize, applyLineHandle, hitShape,
} from "../shapes.js";

describe("getShapeBounds", () => {
  it("returns null for null shape", () => expect(getShapeBounds(null)).toBeNull());

  it("computes rect bounds", () => {
    expect(getShapeBounds({ type: "rect", x: 10, y: 20, w: 30, h: 40 }))
      .toEqual({ left: 10, top: 20, right: 40, bottom: 60, width: 30, height: 40 });
  });

  it("handles negative width/height rect", () => {
    const b = getShapeBounds({ type: "rect", x: 40, y: 60, w: -30, h: -40 });
    expect(b.left).toBe(10);
    expect(b.top).toBe(20);
    expect(b.width).toBe(30);
    expect(b.height).toBe(40);
  });

  it("computes line bounds", () => {
    const b = getShapeBounds({ type: "line", x1: 0, y1: 0, x2: 100, y2: 50 });
    expect(b).toEqual({ left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 });
  });
});

describe("getShapeHandles", () => {
  it("returns 8 handles for rect", () => {
    const handles = getShapeHandles({ type: "rect", x: 0, y: 0, w: 100, h: 100 });
    expect(handles).toHaveLength(8);
  });

  it("returns start/end handles for line", () => {
    const handles = getShapeHandles({ type: "line", x1: 0, y1: 0, x2: 50, y2: 50 });
    expect(handles).toHaveLength(2);
    expect(handles[0].id).toBe("start");
    expect(handles[1].id).toBe("end");
  });
});

describe("getResizeCursor", () => {
  it("returns correct cursor for nw", () => expect(getResizeCursor("nw")).toBe("nwse-resize"));
  it("returns move for unknown", () => expect(getResizeCursor("unknown")).toBe("move"));
});

describe("applyRectResize", () => {
  it("resizes east handle", () => {
    const shape = { x: 10, y: 10, w: 50, h: 50 };
    const start = { x: 10, y: 10, w: 50, h: 50 };
    applyRectResize(shape, "e", start, 20, 0);
    expect(shape.w).toBe(70);
    expect(shape.x).toBe(10);
  });

  it("handles flipped dimensions", () => {
    const shape = { x: 10, y: 10, w: 50, h: 50 };
    const start = { x: 10, y: 10, w: 50, h: 50 };
    applyRectResize(shape, "w", start, 100, 0);
    expect(shape.w).toBeGreaterThan(0);
  });
});

describe("applyLineHandle", () => {
  it("moves start point", () => {
    const shape = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const start = { x1: 0, y1: 0, x2: 100, y2: 100 };
    applyLineHandle(shape, "start", start, 10, 20);
    expect(shape.x1).toBe(10);
    expect(shape.y1).toBe(20);
    expect(shape.x2).toBe(100);
  });

  it("moves end point", () => {
    const shape = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const start = { x1: 0, y1: 0, x2: 100, y2: 100 };
    applyLineHandle(shape, "end", start, -10, -20);
    expect(shape.x2).toBe(90);
    expect(shape.y2).toBe(80);
  });
});

describe("hitShape", () => {
  it("detects point inside rect", () => {
    expect(hitShape({ type: "rect", x: 0, y: 0, w: 100, h: 100 }, 50, 50)).toBe(true);
  });

  it("rejects point outside rect", () => {
    expect(hitShape({ type: "rect", x: 0, y: 0, w: 100, h: 100 }, 150, 50)).toBe(false);
  });

  it("detects point inside ellipse", () => {
    expect(hitShape({ type: "ellipse", x: 0, y: 0, w: 100, h: 100 }, 50, 50)).toBe(true);
  });

  it("rejects point outside ellipse", () => {
    expect(hitShape({ type: "ellipse", x: 0, y: 0, w: 100, h: 100 }, 5, 5)).toBe(false);
  });

  it("detects point near line", () => {
    expect(hitShape({ type: "line", x1: 0, y1: 0, x2: 100, y2: 0 }, 50, 2)).toBe(true);
  });

  it("rejects point far from line", () => {
    expect(hitShape({ type: "line", x1: 0, y1: 0, x2: 100, y2: 0 }, 50, 20)).toBe(false);
  });

  it("returns false for unknown shape type", () => {
    expect(hitShape({ type: "polygon" }, 0, 0)).toBe(false);
  });
});
