import { describe, expect, it } from "vitest";
import { applyImageEffect, blurImageData, findConnectedBounds, sharpenImageData } from "../imageEffects.js";

function image(width, height, pixels) {
  return new ImageData(new Uint8ClampedArray(pixels), width, height);
}

function fixture4x4() {
  return image(4, 4, [
    12, 34, 56, 255, 90, 120, 160, 255, 210, 64, 32, 255, 8, 200, 120, 255,
    255, 240, 200, 255, 64, 16, 180, 255, 128, 128, 128, 255, 20, 60, 240, 255,
    180, 40, 90, 255, 32, 220, 240, 255, 240, 200, 40, 255, 70, 80, 90, 255,
    0, 0, 0, 255, 255, 255, 255, 255, 44, 88, 132, 255, 160, 24, 220, 255,
  ]);
}

function hashImageData(img) {
  let hash = 2166136261;
  for (const byte of img.data) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function seededRng(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
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

  it("hashes hue, saturation, lightness, motion blur, and seeded noise deterministically", () => {
    const source = fixture4x4();

    expect({
      hue: hashImageData(applyImageEffect(source, "hue", 45)),
      saturation: hashImageData(applyImageEffect(source, "saturation", 40)),
      lightness: hashImageData(applyImageEffect(source, "lightness", -20)),
      motionBlur: hashImageData(applyImageEffect(source, "motionBlur", 2)),
      noise: hashImageData(applyImageEffect(source, "noise", 20, { rng: seededRng(7) })),
    }).toEqual({
      hue: "e0cdf493",
      saturation: "71fc02cd",
      lightness: "5a0777ed",
      motionBlur: "de7851bf",
      noise: "648bf6ba",
    });
  });

  const perfIt = globalThis.process?.env?.PERF ? it : it.skip;

  perfIt("records 1024x1024 timings for Tier 2 image effects", () => {
    const pixels = new Uint8ClampedArray(1024 * 1024 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      const value = (i / 4) % 256;
      pixels[i] = value;
      pixels[i + 1] = (value * 3) % 256;
      pixels[i + 2] = (255 - value) % 256;
      pixels[i + 3] = 255;
    }
    const source = new ImageData(pixels, 1024, 1024);
    const kinds = [
      ["brightness", 20],
      ["contrast", 20],
      ["hue", 45],
      ["saturation", 35],
      ["lightness", -15],
      ["invert", 0],
      ["grayscale", 0],
      ["sepia", 0],
      ["threshold", 128],
      ["posterize", 4],
      ["gaussianBlur", 1],
      ["motionBlur", 8],
      ["sharpen", 0],
      ["noise", 20],
    ];
    const timings = {};
    for (const [kind, amount] of kinds) {
      const start = performance.now();
      applyImageEffect(source, kind, amount, { rng: seededRng(7) });
      timings[kind] = Math.round((performance.now() - start) * 10) / 10;
    }
    console.table(timings);
    expect(Object.keys(timings)).toHaveLength(kinds.length);
  });
});
