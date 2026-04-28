import { describe, expect, it } from "vitest";
import { applyImageEffect, blurImageData, findConnectedBounds, sharpenImageData } from "../imageEffects.js";

function image(width, height, pixels) {
  return new ImageData(new Uint8ClampedArray(pixels), width, height);
}

describe("imageEffects", () => {
  it("applies brightness, grayscale, invert, threshold, and posterize effects", () => {
    const source = image(1, 1, [100, 150, 200, 255]);

    expect(Array.from(applyImageEffect(source, "brightness", 20).data)).toEqual([120, 170, 220, 255]);
    expect(Array.from(applyImageEffect(source, "invert").data)).toEqual([155, 105, 55, 255]);
    expect(applyImageEffect(source, "grayscale").data[0]).toBe(applyImageEffect(source, "grayscale").data[1]);
    expect(Array.from(applyImageEffect(source, "threshold", 128).data.slice(0, 3))).toEqual([255, 255, 255]);
    expect(Array.from(applyImageEffect(source, "posterize", 2).data.slice(0, 3))).toEqual([0, 255, 255]);
  });

  it("finds connected magic-wand bounds by tolerance", () => {
    const source = image(3, 2, [
      10, 10, 10, 255, 11, 11, 11, 255, 200, 0, 0, 255,
      12, 12, 12, 255, 210, 0, 0, 255, 211, 0, 0, 255,
    ]);

    expect(findConnectedBounds(source, 0, 0, 3)).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });

  it("runs blur and sharpen kernels without changing dimensions", () => {
    const source = image(2, 2, [
      0, 0, 0, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 0, 0, 0, 255,
    ]);

    expect(blurImageData(source).width).toBe(2);
    expect(sharpenImageData(source).height).toBe(2);
  });
});
