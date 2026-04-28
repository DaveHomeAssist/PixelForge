import { describe, expect, it } from "vitest";
import { floodFill } from "../floodFill.js";

function makeImage(width, height, pixels) {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach((rgba, index) => data.set(rgba, index * 4));
  return new ImageData(data, width, height);
}

const white = [255, 255, 255, 255];
const black = [0, 0, 0, 255];
const red = [255, 0, 0, 255];

describe("floodFill", () => {
  it("fills a rectangular connected region", () => {
    const img = makeImage(3, 2, [white, white, black, white, white, black]);
    const out = floodFill(img, 0, 0, red, 0);

    expect(Array.from(out.data.slice(0, 4))).toEqual(red);
    expect(Array.from(out.data.slice(4, 8))).toEqual(red);
    expect(Array.from(out.data.slice(8, 12))).toEqual(black);
    expect(Array.from(out.data.slice(12, 16))).toEqual(red);
    expect(Array.from(out.data.slice(16, 20))).toEqual(red);
  });

  it("honors tolerance", () => {
    const near = [248, 248, 248, 255];
    const img = makeImage(2, 1, [white, near]);

    expect(Array.from(floodFill(img, 0, 0, red, 2).data.slice(4, 8))).toEqual(near);
    expect(Array.from(floodFill(img, 0, 0, red, 10).data.slice(4, 8))).toEqual(red);
  });

  it("does not fill diagonal-only neighbors", () => {
    const img = makeImage(2, 2, [white, black, black, white]);
    const out = floodFill(img, 0, 0, red, 0);

    expect(Array.from(out.data.slice(0, 4))).toEqual(red);
    expect(Array.from(out.data.slice(12, 16))).toEqual(white);
  });
});
