import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MAX_ZOOM, MIN_ZOOM } from "../constants.js";
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
    selectionMask: null,
    setSelectionMask: vi.fn(),
    ...overrides,
  };
}

function makeBrushArgs(overrides = {}) {
  const arcRadii = [];
  const layerCtx = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "#000",
    imageSmoothingEnabled: true,
    save() {}, restore() {}, beginPath() {},
    arc: (_x, _y, r) => arcRadii.push(r),
    fill() {},
  };
  const layer = {
    id: "layer-1",
    type: "raster",
    ox: 0,
    oy: 0,
    canvas: { width: 100, height: 100, getContext: () => layerCtx },
  };
  const args = makeArgs({
    tool: "brush",
    brushPreset: "soft",
    docRef: { current: { layers: { "layer-1": layer }, order: ["layer-1"] } },
    capturePatchSnapshot: vi.fn(() => ({ layers: [] })),
    ...overrides,
  });
  return { args, arcRadii };
}

function penDown(result, pressure) {
  act(() => {
    result.current.onDown({
      preventDefault: vi.fn(),
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerType: "pen",
      pressure,
    });
  });
}

describe("Apple Pencil pressure", () => {
  it("paints a smaller stamp for a light pen press than a firm one", () => {
    const light = makeBrushArgs();
    const firm = makeBrushArgs();
    const { result: lightHook } = renderHook(() => useCanvasInteractions(light.args));
    const { result: firmHook } = renderHook(() => useCanvasInteractions(firm.args));

    penDown(lightHook, 0.1);
    penDown(firmHook, 1);

    expect(light.arcRadii[0]).toBeGreaterThan(0);
    expect(light.arcRadii[0]).toBeLessThan(firm.arcRadii[0]);
  });

  it("ignores pressure for a mouse (non-pen) pointer", () => {
    const pen = makeBrushArgs();
    const mouse = makeBrushArgs();
    const { result: penHook } = renderHook(() => useCanvasInteractions(pen.args));
    const { result: mouseHook } = renderHook(() => useCanvasInteractions(mouse.args));

    penDown(penHook, 1);
    act(() => {
      mouseHook.current.onDown({
        preventDefault: vi.fn(),
        button: 0,
        clientX: 20,
        clientY: 20,
        pointerType: "mouse",
        pressure: 0.1,
      });
    });

    // Mouse ignores the low pressure value and paints at full size, matching a firm pen.
    expect(mouse.arcRadii[0]).toBe(pen.arcRadii[0]);
  });
});

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

  it("anchors wheel zoom at the cursor", () => {
    let zoom = 2;
    let pan = { x: -100, y: -50 };
    const args = makeArgs({
      tool: "brush",
      zoom,
      pan,
      setZoom: vi.fn((updater) => {
        zoom = updater(zoom);
      }),
      setPan: vi.fn((updater) => {
        pan = typeof updater === "function" ? updater(pan) : updater;
      }),
    });
    renderHook(() => useCanvasInteractions(args));

    act(() => {
      args.vpRef.current.dispatchEvent(new WheelEvent("wheel", {
        clientX: 250,
        clientY: 180,
        deltaY: -100,
        cancelable: true,
      }));
    });

    const docX = (250 - (-100)) / 2;
    const docY = (180 - (-50)) / 2;
    expect((250 - pan.x) / zoom).toBeCloseTo(docX);
    expect((180 - pan.y) / zoom).toBeCloseTo(docY);
  });

  it("clamps wheel zoom to configured bounds", () => {
    let zoom = 0.021;
    const args = makeArgs({
      tool: "brush",
      zoom,
      setZoom: vi.fn((updater) => {
        zoom = updater(zoom);
      }),
      setPan: vi.fn(),
    });
    renderHook(() => useCanvasInteractions(args));

    act(() => {
      args.vpRef.current.dispatchEvent(new WheelEvent("wheel", {
        clientX: 10,
        clientY: 10,
        deltaY: 5000,
        cancelable: true,
      }));
    });
    expect(zoom).toBe(MIN_ZOOM);

    zoom = 63.9;
    act(() => {
      args.vpRef.current.dispatchEvent(new WheelEvent("wheel", {
        clientX: 10,
        clientY: 10,
        deltaY: -5000,
        cancelable: true,
      }));
    });
    expect(zoom).toBe(MAX_ZOOM);
  });
});
