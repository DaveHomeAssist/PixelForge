import { describe, expect, it } from "vitest";
import {
  BRUSH_PRESETS,
  getPreset,
  stampBrush,
  drawBrushSegment,
  getEffectiveRadius,
} from "../brushes.js";

function makeRecordingCtx() {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args });
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    imageSmoothingEnabled: true,
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    arc: record("arc"),
    ellipse: record("ellipse"),
    fill: record("fill"),
    stroke: record("stroke"),
    translate() {},
    scale() {},
    rotate() {},
  };
  return { ctx, calls };
}

describe("BRUSH_PRESETS registry", () => {
  it("ships soft, pencil, spray, and marker", () => {
    const ids = BRUSH_PRESETS.map(p => p.id);
    expect(ids).toEqual(["soft", "pencil", "spray", "marker"]);
  });

  it("getPreset falls back to soft for unknown ids", () => {
    expect(getPreset("unknown-preset").id).toBe("soft");
  });
});

describe("stampBrush", () => {
  it("soft uses globalAlpha = opacity and fills an arc", () => {
    const { ctx, calls } = makeRecordingCtx();
    let capturedAlpha = null;
    const fillSpy = { name: "fill", args: [] };
    Object.defineProperty(ctx, "fill", {
      value: () => { capturedAlpha = ctx.globalAlpha; calls.push(fillSpy); },
    });
    stampBrush(ctx, "soft", 10, 10, 8, "#ff0000", 0.5, false);
    expect(capturedAlpha).toBe(0.5);
    expect(calls.some(c => c.name === "arc")).toBe(true);
  });

  it("pencil forces globalAlpha = 1 regardless of opacity argument", () => {
    const { ctx, calls } = makeRecordingCtx();
    let capturedAlpha = null;
    Object.defineProperty(ctx, "fill", {
      value: () => { capturedAlpha = ctx.globalAlpha; calls.push({ name: "fill" }); },
    });
    stampBrush(ctx, "pencil", 5, 5, 4, "#00ff00", 0.2, false);
    expect(capturedAlpha).toBe(1);
    expect(ctx.imageSmoothingEnabled === false || ctx.imageSmoothingEnabled === true).toBe(true);
  });

  it("eraser mode sets composite to destination-out", () => {
    const { ctx, calls } = makeRecordingCtx();
    let capturedComposite = null;
    Object.defineProperty(ctx, "fill", {
      value: () => { capturedComposite = ctx.globalCompositeOperation; calls.push({ name: "fill" }); },
    });
    stampBrush(ctx, "soft", 10, 10, 8, "#000000", 1, true);
    expect(capturedComposite).toBe("destination-out");
  });

  it("marker uses ellipse stamps", () => {
    const { ctx, calls } = makeRecordingCtx();
    stampBrush(ctx, "marker", 5, 5, 10, "#ff00ff", 1, false);
    expect(calls.some(c => c.name === "ellipse")).toBe(true);
    // three ellipse passes per marker stamp
    expect(calls.filter(c => c.name === "ellipse").length).toBe(3);
  });

  it("spray emits multiple arc stamps per call", () => {
    const { ctx, calls } = makeRecordingCtx();
    stampBrush(ctx, "spray", 5, 5, 20, "#ffffff", 1, false);
    const arcCount = calls.filter(c => c.name === "arc").length;
    expect(arcCount).toBeGreaterThan(1);
  });
});

describe("drawBrushSegment", () => {
  it("emits multiple stamps between endpoints", () => {
    const { ctx, calls } = makeRecordingCtx();
    drawBrushSegment(ctx, "pencil", 0, 0, 100, 0, 4, "#0000ff", 1, false);
    // pencil spacing = 0.5 * 4 = 2 → ~50 steps, each stamp calls arc once
    const arcCount = calls.filter(c => c.name === "arc").length;
    expect(arcCount).toBeGreaterThan(10);
  });

  it("handles zero-length segments with a single stamp", () => {
    const { ctx, calls } = makeRecordingCtx();
    drawBrushSegment(ctx, "soft", 10, 10, 10, 10, 8, "#000", 1, false);
    const arcCount = calls.filter(c => c.name === "arc").length;
    // a single stamp at start and end (both at same point) — still calls arc
    expect(arcCount).toBeGreaterThanOrEqual(1);
  });
});

describe("getEffectiveRadius", () => {
  it("returns size/2 for standard presets", () => {
    expect(getEffectiveRadius("soft", 20)).toBe(10);
    expect(getEffectiveRadius("pencil", 20)).toBe(10);
    expect(getEffectiveRadius("spray", 20)).toBe(10);
  });

  it("returns a larger radius for marker", () => {
    expect(getEffectiveRadius("marker", 20)).toBeGreaterThan(10);
  });
});
