import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TOOLS } from "../constants.js";
import useCanvasInteractions from "../hooks/useCanvasInteractions.js";

function makeCanvas(width = 64, height = 64, fill = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    width,
    height,
    right: width,
    bottom: height,
  }));

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  ctx.createLinearGradient = vi.fn(() => ({ addColorStop: vi.fn() }));
  return canvas;
}

function pointer(x, y, button = 0) {
  return {
    preventDefault: vi.fn(),
    button,
    clientX: x,
    clientY: y,
  };
}

function drag(result, from, to) {
  act(() => result.current.onDown(pointer(from.x, from.y)));
  act(() => result.current.onMove(pointer(to.x, to.y)));
  act(() => result.current.onUp());
}

function makeRasterLayer(overrides = {}) {
  return {
    id: "layer-raster",
    name: "Raster",
    type: "raster",
    visible: true,
    opacity: 1,
    blend: "source-over",
    locked: false,
    contentHint: "blank",
    ox: 0,
    oy: 0,
    canvas: makeCanvas(),
    ...overrides,
  };
}

function makeVectorLayer(overrides = {}) {
  return {
    id: "layer-vector",
    name: "Vector",
    type: "vector",
    visible: true,
    opacity: 1,
    blend: "source-over",
    locked: false,
    ox: 0,
    oy: 0,
    shapes: [],
    ...overrides,
  };
}

function makeArgs({ layer = makeRasterLayer(), tool = "brush", selectedShape = null, selectionMask = null, overrides = {} } = {}) {
  const viewport = document.createElement("div");
  const docRef = { current: { layers: { [layer.id]: layer }, order: [layer.id] } };
  const capturePatchSnapshot = vi.fn((ids) => ({
    mode: "patch",
    layers: ids.map((id) => {
      const currentLayer = docRef.current.layers[id];
      return {
        id,
        imageData: currentLayer.type === "raster"
          ? currentLayer.canvas.getContext("2d").getImageData(0, 0, currentLayer.canvas.width, currentLayer.canvas.height)
          : null,
      };
    }),
  }));

  const args = {
    cvRef: { current: layer.canvas || makeCanvas() },
    vpRef: { current: viewport },
    tsRef: { current: { down: false, scrX: 0, scrY: 0 } },
    spaceRef: { current: false },
    panningRef: { current: false },
    panStateRef: { current: { x: 0, y: 0, ox: 0, oy: 0 } },
    docRef,
    activeId: layer.id,
    selectedShape,
    tool,
    workspace: {},
    zoom: 1,
    pan: { x: 0, y: 0 },
    brushSize: 8,
    brushOpacity: 1,
    brushPreset: "pencil",
    bucketTolerance: 16,
    color1: "#2a6f97",
    color2: "#16324f",
    fillOn: true,
    strokeOn: true,
    strokeW: 2,
    getLayer: vi.fn((id) => docRef.current.layers[id]),
    findShapeRecord: vi.fn(() => null),
    clearSelection: vi.fn(),
    canEditLayer: vi.fn(() => true),
    capturePatchSnapshot,
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
    onCreateText: vi.fn(),
    selectionMask,
    setSelectionMask: vi.fn(),
    ...overrides,
  };

  return { args, layer };
}

function runHarness(toolId) {
  return TOOL_HARNESS[toolId]();
}

const TOOL_HARNESS = {
  move() {
    const { args, layer } = makeArgs({ tool: "move" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    drag(result, { x: 5, y: 6 }, { x: 19, y: 27 });

    expect(layer.ox).toBe(14);
    expect(layer.oy).toBe(21);
    expect(args.commitPatchHistory).toHaveBeenCalledWith(expect.anything(), [layer.id], { selectedShape: null });
  },

  hand() {
    const { args } = makeArgs({ tool: "hand" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => result.current.onDown(pointer(10, 20)));
    act(() => result.current.onMove(pointer(25, 42)));
    act(() => result.current.onUp());

    expect(args.setIsPanning).toHaveBeenNthCalledWith(1, true);
    expect(args.setPan).toHaveBeenCalledWith({ x: 15, y: 22 });
    expect(args.setIsPanning).toHaveBeenLastCalledWith(false);
  },

  marquee() {
    const { args, layer } = makeArgs({ tool: "marquee" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    drag(result, { x: 8, y: 9 }, { x: 35, y: 41 });

    expect(args.setSelectionMask).toHaveBeenCalledWith({
      layerId: layer.id,
      rect: { x: 8, y: 9, w: 27, h: 32 },
      floating: null,
    });
  },

  lasso() {
    const { args, layer } = makeArgs({ tool: "lasso" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => result.current.onDown(pointer(12, 14)));
    act(() => result.current.onMove(pointer(33, 18)));
    act(() => result.current.onMove(pointer(24, 44)));
    act(() => result.current.onUp());

    expect(args.setSelectionMask).toHaveBeenCalledWith({
      layerId: layer.id,
      rect: { x: 12, y: 14, w: 21, h: 30 },
      floating: null,
    });
  },

  magic() {
    const { args, layer } = makeArgs({ tool: "magic" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => result.current.onDown(pointer(4, 5)));

    expect(args.setSelectionMask).toHaveBeenCalledWith({
      layerId: layer.id,
      rect: { x: 0, y: 0, w: 64, h: 64 },
      floating: null,
    });
    expect(args.triggerFeedback).toHaveBeenCalledWith("tool-magic", "success", 140);
  },

  brush() {
    const { args, layer } = makeArgs({ tool: "brush" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    drag(result, { x: 8, y: 8 }, { x: 24, y: 24 });

    expect(layer.contentHint).toBe("edited");
    expect(args.capturePatchSnapshot).toHaveBeenCalledWith([layer.id]);
    expect(args.pushHistory).toHaveBeenCalled();
  },

  eraser() {
    const { args, layer } = makeArgs({ tool: "eraser" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    drag(result, { x: 9, y: 9 }, { x: 29, y: 18 });

    expect(layer.contentHint).toBe("edited");
    expect(args.capturePatchSnapshot).toHaveBeenCalledWith([layer.id]);
    expect(args.pushHistory).toHaveBeenCalled();
  },

  bucket() {
    const { args, layer } = makeArgs({ tool: "bucket" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => result.current.onDown(pointer(3, 3)));

    expect(layer.contentHint).toBe("edited");
    expect(args.commitPatchHistory).toHaveBeenCalledWith(expect.anything(), [layer.id]);
    expect(args.triggerFeedback).toHaveBeenCalledWith("tool-bucket", "success", 140);
  },

  gradient() {
    const { args, layer } = makeArgs({ tool: "gradient" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    drag(result, { x: 2, y: 3 }, { x: 50, y: 51 });

    expect(layer.canvas.getContext("2d").createLinearGradient).toHaveBeenCalledWith(2, 3, 50, 51);
    expect(args.commitPatchHistory).toHaveBeenCalledWith(expect.anything(), [layer.id], { selectedShape: null });
    expect(args.triggerFeedback).toHaveBeenCalledWith("tool-gradient", "success", 140);
  },

  rect() {
    verifyVectorToolCreatesShape("rect");
  },

  ellipse() {
    verifyVectorToolCreatesShape("ellipse");
  },

  polygon() {
    verifyVectorToolCreatesShape("polygon");
  },

  star() {
    verifyVectorToolCreatesShape("star");
  },

  line() {
    verifyVectorToolCreatesShape("line");
  },

  pen() {
    verifyVectorToolCreatesShape("pen", "path");
  },

  text() {
    const { args } = makeArgs({ tool: "text" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => result.current.onDown(pointer(17, 23)));

    expect(args.onCreateText).toHaveBeenCalledWith({ x: 17, y: 23 });
  },

  eyedropper() {
    const canvas = makeCanvas(64, 64, "#0a141e");
    const layer = makeRasterLayer({ canvas });
    const { args } = makeArgs({ layer, tool: "eyedropper" });
    const { result } = renderHook(() => useCanvasInteractions(args));

    act(() => result.current.onDown(pointer(2, 2)));

    expect(args.setColor1).toHaveBeenCalledWith("#0a141e");
    expect(args.triggerFeedback).toHaveBeenCalledWith("color-primary", "success", 140);
  },
};

function verifyVectorToolCreatesShape(tool, expectedType = tool) {
  const layer = makeVectorLayer();
  const { args } = makeArgs({ layer, tool });
  const { result } = renderHook(() => useCanvasInteractions(args));

  drag(result, { x: 10, y: 12 }, { x: 42, y: 47 });

  expect(layer.shapes).toHaveLength(1);
  expect(layer.shapes[0]).toEqual(expect.objectContaining({ type: expectedType }));
  expect(args.setSelectedShape).toHaveBeenCalledWith({ layerId: layer.id, shapeId: layer.shapes[0].id });
  expect(args.commitPatchHistory).toHaveBeenCalledWith(
    expect.anything(),
    [layer.id],
    { selectedShape: { layerId: layer.id, shapeId: layer.shapes[0].id } },
  );
}

describe("PixelForge tool harness", () => {
  it("has one harness case for every registered tool", () => {
    expect(Object.keys(TOOL_HARNESS).sort()).toEqual(TOOLS.map(tool => tool.id).sort());
  });

  it.each(TOOLS.map(tool => [tool.id]))("verifies the %s tool interaction path", (toolId) => {
    runHarness(toolId);
  });
});
