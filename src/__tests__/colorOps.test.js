import { describe, expect, it } from "vitest";
import {
  formatHex, hslToRgb, hsvToRgb, parseHex, rgbToHsl, rgbToHsv,
} from "../colorOps.js";

const FIXTURES = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#808080",
  "#2a6f97",
  "#16324f",
  "#d63031",
];

function expectRgbClose(actual, expected) {
  expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(1);
}

describe("colorOps", () => {
  it("round-trips RGB through HSL on fixture colors", () => {
    for (const hex of FIXTURES) {
      const rgb = parseHex(hex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      expectRgbClose(hslToRgb(hsl.h, hsl.s, hsl.l), rgb);
    }
  });

  it("round-trips RGB through HSV on fixture colors", () => {
    for (const hex of FIXTURES) {
      const rgb = parseHex(hex);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      expectRgbClose(hsvToRgb(hsv.h, hsv.s, hsv.v), rgb);
    }
  });

  it("round-trips 3 and 6 digit hex values", () => {
    expect(formatHex(parseHex("#abc"))).toBe("#aabbcc");
    expect(formatHex(parseHex("ABCDEF"))).toBe("#abcdef");
    expect(formatHex(parseHex("#123456"))).toBe("#123456");
    expect(parseHex("not-hex")).toBeNull();
  });
});
