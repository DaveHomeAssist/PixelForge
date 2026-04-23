import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRasterLayerFromImage } from "../imageImport.js";

function stubImageSize(width, height) {
  const OriginalImage = globalThis.Image;
  class SizedImage extends OriginalImage {
    set src(value) {
      this._src = value;
      this.width = width;
      this.height = height;
      this.naturalWidth = width;
      this.naturalHeight = height;
      queueMicrotask(() => { try { this.onload?.(); } catch { /* ignore */ } });
    }
    get src() {
      return this._src;
    }
  }
  globalThis.Image = SizedImage;
  window.Image = SizedImage;
  return () => {
    globalThis.Image = OriginalImage;
    window.Image = OriginalImage;
  };
}

function makeOpts(overrides = {}) {
  const docRef = { current: { layers: {}, order: [] } };
  const setActiveId = vi.fn();
  const setSelectedShape = vi.fn();
  const withFullHistory = vi.fn((mutate) => mutate());
  return {
    docRef,
    docW: 1200,
    docH: 800,
    withFullHistory,
    setActiveId,
    setSelectedShape,
    ...overrides,
  };
}

describe("createRasterLayerFromImage", () => {
  let restoreImage = null;

  afterEach(() => {
    if (restoreImage) { restoreImage(); restoreImage = null; }
  });

  it("creates a raster layer from a data URL", async () => {
    restoreImage = stubImageSize(200, 100);
    const opts = makeOpts();
    const layerId = await createRasterLayerFromImage(
      "data:image/png;base64,AAAA",
      opts,
    );
    expect(layerId).toBeTruthy();
    expect(opts.docRef.current.order).toEqual([layerId]);
    const layer = opts.docRef.current.layers[layerId];
    expect(layer.type).toBe("raster");
    expect(layer.canvas.width).toBe(1200);
    expect(layer.canvas.height).toBe(800);
    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
    expect(opts.setActiveId).toHaveBeenCalledWith(layerId);
    expect(opts.setSelectedShape).toHaveBeenCalledWith(null);
    expect(opts.withFullHistory).toHaveBeenCalledTimes(1);
  });

  it("scales down an image larger than the document and centers it", async () => {
    restoreImage = stubImageSize(2400, 1200);
    const opts = makeOpts();
    const drawImageSpy = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    try {
      await createRasterLayerFromImage("data:image/png;base64,AAAA", opts);
      expect(drawImageSpy).toHaveBeenCalledTimes(1);
      const args = drawImageSpy.mock.calls[0];
      // scale = min(1200/2400, 800/1200, 1) = 0.5 → drawW=1200, drawH=600 → x=0, y=100
      expect(args[3]).toBe(1200);
      expect(args[4]).toBe(600);
      expect(args[1]).toBe(0);
      expect(args[2]).toBe(100);
    } finally {
      drawImageSpy.mockRestore();
    }
  });

  it("does not upscale an image smaller than the document", async () => {
    restoreImage = stubImageSize(400, 200);
    const opts = makeOpts();
    const drawImageSpy = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    try {
      await createRasterLayerFromImage("data:image/png;base64,AAAA", opts);
      const args = drawImageSpy.mock.calls[0];
      // scale capped at 1 → drawW=400, drawH=200 → centered: x=400, y=300
      expect(args[3]).toBe(400);
      expect(args[4]).toBe(200);
      expect(args[1]).toBe(400);
      expect(args[2]).toBe(300);
    } finally {
      drawImageSpy.mockRestore();
    }
  });

  it("respects an explicit `at` position", async () => {
    restoreImage = stubImageSize(100, 100);
    const opts = makeOpts();
    const drawImageSpy = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");
    try {
      await createRasterLayerFromImage("data:image/png;base64,AAAA", {
        ...opts,
        at: { x: 50, y: 60 },
      });
      const args = drawImageSpy.mock.calls[0];
      expect(args[1]).toBe(50);
      expect(args[2]).toBe(60);
    } finally {
      drawImageSpy.mockRestore();
    }
  });

  it("creates a URL for a Blob source and revokes it after loading", async () => {
    restoreImage = stubImageSize(100, 100);
    const createURL = vi.fn(() => "blob:fake");
    const revokeURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createURL;
    URL.revokeObjectURL = revokeURL;
    try {
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
      await createRasterLayerFromImage(blob, makeOpts());
      expect(createURL).toHaveBeenCalledWith(blob);
      expect(revokeURL).toHaveBeenCalledWith("blob:fake");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it("uses the supplied layer name and contentHint", async () => {
    restoreImage = stubImageSize(50, 50);
    const opts = makeOpts();
    const layerId = await createRasterLayerFromImage("data:image/png;base64,AAAA", {
      ...opts,
      name: "Screenshot",
      contentHint: "paste",
    });
    const layer = opts.docRef.current.layers[layerId];
    expect(layer.name).toBe("Screenshot");
    expect(layer.contentHint).toBe("paste");
  });
});

describe("createRasterLayerFromImage rejections", () => {
  it("throws on unsupported sources", async () => {
    await expect(
      createRasterLayerFromImage(12345, makeOpts()),
    ).rejects.toThrow(/Unsupported image source/);
  });
});

// Regression: the imported helper should not expose jest globals
describe("module surface", () => {
  beforeEach(() => {});
  it("exports createRasterLayerFromImage", () => {
    expect(typeof createRasterLayerFromImage).toBe("function");
  });
});
