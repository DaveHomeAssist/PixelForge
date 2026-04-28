import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useCanvasInteractions from "../hooks/useCanvasInteractions.js";

function makeArgs(overrides = {}) {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0 }));
  canvas.getContext = vi.fn(() => ({
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([10, 20, 30, 255]) })),
  }));

  const viewport = document.createElement("div");

  return {
    cvRef: { current: canvas },
    vpRef: { current: viewport },
    tsRef: { current: { down: false, scrX: 0, scrY: 0 } },
    spaceRef: { current: false },
    panningRef: { current: false },
    panStateRef: { current: { x: 0, y: 0, ox: 0, oy: 0 } },
    docRef: { current: { layers: { "layer-1": { id: "layer-1", type: "raster", ox: 0, oy: 0 } }, order: ["layer-1"] } },
    activeId: "layer-1",
    selectedShape: null,
    tool: "eyedropper",
    zoom: 1,
    pan: { x: 0, y: 0 },
    brushSize: 10,
    brushOpacity: 1,
    color1: "#000000",
    fillOn: true,
    strokeOn: true,
    strokeW: 2,
    getLayer: vi.fn(),
    findShapeRecord: vi.fn(() => null),
    clearSelection: vi.fn(),
    canEditLayer: vi.fn(() => true),
    capturePatchSnapshot: vi.fn(),
    commitPatchHistory: vi.fn(),
    pushHistory: vi.fn(),
    syncEditor: vi.fn(),
    setSelectedShape: vi.fn(),
    setColor1: vi.fn(),
    setIsPanning: vi.fn(),
    setPan: vi.fn(),
    setZoom: vi.fn(),
    bump: vi.fn(),
    flash: vi.fn(),
    triggerFeedback: vi.fn(),
    ...overrides,
  };
}

describe("useCanvasInteractions", () => {
  it("picks the primary color from the canvas with the eyedropper tool", () => {
    const args = makeArgs();
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => {
      result.current.onDown({
        preventDefault: vi.fn(),
        button: 0,
        clientX: 8,
        clientY: 12,
      });
    });

    expect(args.setColor1).toHaveBeenCalledWith("#0a141e");
    expect(args.triggerFeedback).toHaveBeenCalledWith("color-primary", "success", 140);
    expect(args.flash).toHaveBeenCalledWith("Picked #0a141e", "success", 1200);
  });

  it("reports panning state while space-drag panning", () => {
    const args = makeArgs({ spaceRef: { current: true } });
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => {
      result.current.onDown({
        preventDefault: vi.fn(),
        button: 0,
        clientX: 20,
        clientY: 30,
      });
    });

    expect(args.panningRef.current).toBe(true);
    expect(args.setIsPanning).toHaveBeenCalledWith(true);

    act(() => {
      result.current.onUp();
    });

    expect(args.panningRef.current).toBe(false);
    expect(args.setIsPanning).toHaveBeenCalledWith(false);
  });
});
