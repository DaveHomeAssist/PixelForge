import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useLayerOps from "../hooks/useLayerOps.js";

function makeArgs(overrides = {}) {
  const docRef = {
    current: {
      layers: {},
      order: [],
    },
  };
  const args = {
    docRef,
    docW: 64,
    docH: 64,
    activeId: null,
    selectedShape: null,
    setActiveId: vi.fn(),
    setSelectedShape: vi.fn(),
    getLayer: vi.fn(id => docRef.current.layers[id]),
    withFullHistory: vi.fn((mutate) => mutate()),
    capturePatchSnapshot: vi.fn(() => ({ mode: "patch", layers: [] })),
    commitPatchHistory: vi.fn(),
    canEditLayer: vi.fn(() => true),
    triggerFeedback: vi.fn(),
    flash: vi.fn(),
    ...overrides,
  };
  return args;
}

describe("useLayerOps", () => {
  it("creates text layers with supplied text style", () => {
    const args = makeArgs();
    const { result } = renderHook(() => useLayerOps(args));

    act(() => {
      result.current.addTextLayerAt({ x: 12, y: 18 }, { color: "#abcdef" });
    });

    const id = args.docRef.current.order[0];
    expect(args.docRef.current.layers[id]).toEqual(expect.objectContaining({
      type: "text",
      color: "#abcdef",
      ox: 12,
      oy: 18,
    }));
  });

  it("rasterizes the active vector layer in place", () => {
    const vectorLayer = {
      id: "vector-1",
      name: "Shapes",
      type: "vector",
      visible: true,
      opacity: 1,
      blend: "source-over",
      locked: false,
      ox: 0,
      oy: 0,
      shapes: [{ id: "shape-1", type: "rect", x: 4, y: 5, w: 20, h: 18, fill: "#ff0000", stroke: null, strokeWidth: 1 }],
    };
    const args = makeArgs({ activeId: vectorLayer.id });
    args.docRef.current.layers[vectorLayer.id] = vectorLayer;
    args.docRef.current.order = [vectorLayer.id];

    const { result } = renderHook(() => useLayerOps(args));

    act(() => {
      result.current.rasterizeLayer(vectorLayer.id);
    });

    const rasterLayer = args.docRef.current.layers[vectorLayer.id];
    expect(rasterLayer.type).toBe("raster");
    expect(rasterLayer.canvas.width).toBe(64);
    expect(rasterLayer.canvas.height).toBe(64);
    expect(rasterLayer.shapes).toBeUndefined();
    expect(args.setSelectedShape).toHaveBeenCalledWith(null);
    expect(args.triggerFeedback).toHaveBeenCalledWith("layer-rasterize", "success");
  });

  it("preserves layer compositing metadata when rasterizing text", () => {
    const textLayer = {
      id: "text-1",
      name: "Headline",
      type: "text",
      visible: false,
      opacity: 0.42,
      blend: "multiply",
      locked: false,
      effect: "glow",
      maskEnabled: true,
      clipToBelow: true,
      ox: 9,
      oy: 11,
      text: "Hello",
      fontFamily: "Inter, sans-serif",
      fontSize: 48,
      fontWeight: 700,
      italic: true,
      color: "#abcdef",
      align: "center",
      maxWidth: 240,
    };
    const args = makeArgs({ activeId: textLayer.id });
    args.docRef.current.layers[textLayer.id] = textLayer;
    args.docRef.current.order = [textLayer.id];

    const { result } = renderHook(() => useLayerOps(args));

    act(() => {
      result.current.rasterizeLayer(textLayer.id);
    });

    expect(args.docRef.current.layers[textLayer.id]).toEqual(expect.objectContaining({
      id: textLayer.id,
      name: "Headline",
      type: "raster",
      visible: false,
      opacity: 0.42,
      blend: "multiply",
      effect: "glow",
      maskEnabled: true,
      clipToBelow: true,
      ox: 9,
      oy: 11,
    }));
    expect(args.docRef.current.layers[textLayer.id].text).toBeUndefined();
  });

  it("does not rasterize locked layers", () => {
    const vectorLayer = {
      id: "vector-locked",
      name: "Locked Shapes",
      type: "vector",
      visible: true,
      opacity: 1,
      blend: "source-over",
      locked: true,
      ox: 0,
      oy: 0,
      shapes: [],
    };
    const args = makeArgs({
      activeId: vectorLayer.id,
      canEditLayer: vi.fn(() => false),
    });
    args.docRef.current.layers[vectorLayer.id] = vectorLayer;
    args.docRef.current.order = [vectorLayer.id];

    const { result } = renderHook(() => useLayerOps(args));

    act(() => {
      result.current.rasterizeLayer(vectorLayer.id);
    });

    expect(args.docRef.current.layers[vectorLayer.id]).toBe(vectorLayer);
    expect(args.withFullHistory).not.toHaveBeenCalled();
    expect(args.triggerFeedback).not.toHaveBeenCalledWith("layer-rasterize", "success");
  });
});
