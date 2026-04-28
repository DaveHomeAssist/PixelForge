import { describe, expect, it } from "vitest";
import { imageDataToFile, readSelectionImageData } from "../clipboard.js";
import { makeCanvas } from "../utils.js";

function makeLayer() {
  const canvas = makeCanvas(20, 20);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#123456";
  ctx.fillRect(0, 0, 20, 20);
  return { id: "layer-1", type: "raster", canvas };
}

describe("selection clipboard helpers", () => {
  it("reads selected pixels from a raster layer", () => {
    const layer = makeLayer();
    const imageData = readSelectionImageData(layer, {
      layerId: layer.id,
      rect: { x: 2, y: 3, w: 5, h: 6 },
      floating: null,
    });

    expect(imageData.width).toBe(5);
    expect(imageData.height).toBe(6);
    expect(Array.from(imageData.data.slice(0, 4))).toEqual([18, 52, 86, 255]);
  });

  it("clones floating selection data so future edits do not mutate the clipboard", () => {
    const floating = new ImageData(new Uint8ClampedArray([1, 2, 3, 255]), 1, 1);
    const imageData = readSelectionImageData(makeLayer(), {
      layerId: "layer-1",
      rect: { x: 0, y: 0, w: 1, h: 1 },
      floating: { imageData: floating, ox: 0, oy: 0 },
    });

    floating.data[0] = 99;
    expect(imageData.data[0]).toBe(1);
  });

  it("returns null for invalid selections so stale clipboard data can be cleared", () => {
    expect(readSelectionImageData(null, {
      layerId: "missing",
      rect: { x: 0, y: 0, w: 1, h: 1 },
      floating: null,
    })).toBeNull();
  });

  it("converts selection data to a PNG file for internal paste", async () => {
    const file = await imageDataToFile(new ImageData(new Uint8ClampedArray([1, 2, 3, 255]), 1, 1));

    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/png");
    expect(file.name).toBe("PixelForge Selection.png");
  });
});
