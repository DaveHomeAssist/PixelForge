import { describe, it, expect, vi } from "vitest";
import {
  createDefaultDocument, buildProjectPayload, buildDraftPayload, hydrateProject, hydrateDraftPayload,
  captureLayerSnapshot, restoreLayerSnapshot,
} from "../serialization.js";

describe("createDefaultDocument", () => {
  it("creates a doc with two layers (raster bg + vector)", () => {
    const { doc, activeId } = createDefaultDocument(100, 100, "#ffffff");
    expect(doc.order).toHaveLength(2);
    expect(doc.layers[doc.order[0]].type).toBe("raster");
    expect(doc.layers[doc.order[1]].type).toBe("vector");
    expect(activeId).toBe(doc.order[0]);
  });

  it("fills background canvas with provided color", () => {
    const { doc } = createDefaultDocument(2, 2, "#ff0000");
    const bg = doc.layers[doc.order[0]];
    const pixel = bg.canvas.getContext("2d").getImageData(0, 0, 1, 1).data;
    expect(pixel[0]).toBe(255); // R
    expect(pixel[1]).toBe(0);   // G
    expect(pixel[2]).toBe(0);   // B
  });
});

describe("buildProjectPayload + hydrateProject round-trip", () => {
  it("round-trips a document through serialize/hydrate", async () => {
    const { doc, activeId } = createDefaultDocument(64, 64);
    const payload = buildProjectPayload(doc, 64, 64, activeId, null);

    expect(payload.v).toBe(3);
    expect(payload.w).toBe(64);
    expect(payload.layers).toHaveLength(2);

    const hydrated = await hydrateProject(payload);
    expect(hydrated.docW).toBe(64);
    expect(hydrated.docH).toBe(64);
    expect(hydrated.doc.order).toHaveLength(2);
    expect(hydrated.doc.layers[hydrated.doc.order[0]].type).toBe("raster");
  });

  it("rejects invalid format", async () => {
    await expect(hydrateProject({})).rejects.toThrow("Bad format");
    await expect(hydrateProject(null)).rejects.toThrow();
  });

  it("round-trips a text layer through v3", async () => {
    const { doc, activeId } = createDefaultDocument(200, 200);
    const textLayer = {
      id: "t1",
      name: "Headline",
      type: "text",
      visible: true,
      opacity: 1,
      blend: "source-over",
      locked: false,
      ox: 20,
      oy: 30,
      text: "Hello World",
      fontFamily: "Inter, sans-serif",
      fontSize: 64,
      fontWeight: 700,
      italic: false,
      color: "#112233",
      align: "center",
      maxWidth: null,
    };
    doc.layers[textLayer.id] = textLayer;
    doc.order.push(textLayer.id);

    const payload = buildProjectPayload(doc, 200, 200, activeId, null);
    expect(payload.v).toBe(3);
    const serialized = payload.layers.find(l => l.type === "text");
    expect(serialized.text).toBe("Hello World");
    expect(serialized.fontWeight).toBe(700);

    const hydrated = await hydrateProject(payload);
    const restored = hydrated.doc.layers.t1;
    expect(restored).toBeDefined();
    expect(restored.type).toBe("text");
    expect(restored.text).toBe("Hello World");
    expect(restored.fontSize).toBe(64);
    expect(restored.color).toBe("#112233");
    expect(restored.align).toBe("center");
  });

  it("loads a v2 document without text layers", async () => {
    const legacy = {
      v: 2,
      w: 100, h: 100, aid: "r1",
      layers: [
        { id: "r1", name: "Bg", type: "raster", visible: true, opacity: 1, blend: "source-over", locked: false, ox: 0, oy: 0, data: "data:image/png;base64,AAAA" },
      ],
    };
    const hydrated = await hydrateProject(legacy);
    expect(hydrated.doc.order).toHaveLength(1);
    expect(hydrated.doc.layers.r1.type).toBe("raster");
  });
});

describe("buildDraftPayload + hydrateDraftPayload", () => {
  it("serializes raster layers as blobs for IndexedDB drafts", async () => {
    const { doc, activeId } = createDefaultDocument(16, 16, "#ffffff");
    const rasterLayer = doc.layers[doc.order[0]];
    rasterLayer.canvas.getContext("2d").fillRect(0, 0, 4, 4);

    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(new Blob(["draft"], { type: "image/png" }));
    };

    try {
      const payload = await buildDraftPayload(doc, 16, 16, activeId, { layerId: "a", shapeId: "b" });
      expect(payload.layers[0].blob).toBeInstanceOf(Blob);
      expect(payload.layers[0].data).toBeUndefined();
      expect(payload.selectedShape).toEqual({ layerId: "a", shapeId: "b" });
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  });

  it("hydrates raster draft blobs back into a project", async () => {
    const originalFileReader = globalThis.FileReader;
    const originalImage = window.Image;
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

    class MockFileReader {
      readAsDataURL() {
        this.result = "data:image/png;base64,ZmFrZQ==";
        this.onload?.({ target: this });
      }
    }

    class MockImage {
      set src(_value) {
        queueMicrotask(() => this.onload?.());
      }
    }

    globalThis.FileReader = MockFileReader;
    window.Image = MockImage;
    CanvasRenderingContext2D.prototype.drawImage = vi.fn();

    try {
      const hydrated = await hydrateDraftPayload({
        v: 2,
        w: 24,
        h: 24,
        aid: "layer-1",
        selectedShape: null,
        layers: [
          {
            id: "layer-1",
            name: "Background",
            type: "raster",
            visible: true,
            opacity: 1,
            blend: "source-over",
            locked: false,
            ox: 0,
            oy: 0,
            contentHint: "background",
            blob: new Blob(["draft"], { type: "image/png" }),
          },
          {
            id: "layer-2",
            name: "Shapes",
            type: "vector",
            visible: true,
            opacity: 1,
            blend: "source-over",
            locked: false,
            ox: 0,
            oy: 0,
            shapes: [{ id: "shape-1", type: "rect", x: 1, y: 2, w: 3, h: 4 }],
          },
        ],
      });

      expect(hydrated.docW).toBe(24);
      expect(hydrated.docH).toBe(24);
      expect(hydrated.doc.layers["layer-1"].type).toBe("raster");
      expect(hydrated.doc.layers["layer-2"].shapes).toHaveLength(1);
      expect(CanvasRenderingContext2D.prototype.drawImage).toHaveBeenCalled();
    } finally {
      globalThis.FileReader = originalFileReader;
      window.Image = originalImage;
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
    }
  });
});

describe("captureLayerSnapshot + restoreLayerSnapshot", () => {
  it("round-trips a raster layer", () => {
    const { doc } = createDefaultDocument(32, 32);
    const layer = doc.layers[doc.order[0]];
    const snap = captureLayerSnapshot(layer);

    expect(snap.type).toBe("raster");
    expect(snap.imageData).toBeInstanceOf(ImageData);

    const restored = restoreLayerSnapshot(snap, 32, 32);
    expect(restored.type).toBe("raster");
    expect(restored.canvas.width).toBe(32);
  });

  it("round-trips a vector layer", () => {
    const { doc } = createDefaultDocument(32, 32);
    const layer = doc.layers[doc.order[1]];
    layer.shapes = [{ id: "s1", type: "rect", x: 0, y: 0, w: 10, h: 10 }];

    const snap = captureLayerSnapshot(layer);
    expect(snap.type).toBe("vector");
    expect(snap.shapes).toHaveLength(1);

    const restored = restoreLayerSnapshot(snap, 32, 32);
    expect(restored.shapes).toHaveLength(1);
    expect(restored.shapes[0].id).toBe("s1");
  });

  it("round-trips a text layer", () => {
    const layer = {
      id: "t1",
      name: "Title",
      type: "text",
      visible: true,
      opacity: 0.8,
      blend: "multiply",
      locked: true,
      ox: 10,
      oy: 20,
      text: "Ship it",
      fontFamily: "Inter, sans-serif",
      fontSize: 72,
      fontWeight: 600,
      italic: true,
      color: "#ff00aa",
      align: "right",
      maxWidth: 400,
    };

    const snap = captureLayerSnapshot(layer);
    expect(snap.type).toBe("text");
    expect(snap.text).toBe("Ship it");
    expect(snap.italic).toBe(true);
    expect(snap.locked).toBe(true);

    const restored = restoreLayerSnapshot(snap, 200, 200);
    expect(restored.type).toBe("text");
    expect(restored.text).toBe("Ship it");
    expect(restored.fontWeight).toBe(600);
    expect(restored.color).toBe("#ff00aa");
    expect(restored.align).toBe("right");
    expect(restored.maxWidth).toBe(400);
    expect(restored.locked).toBe(true);
  });

  it("returns null for null layer", () => {
    expect(captureLayerSnapshot(null)).toBeNull();
  });
});
