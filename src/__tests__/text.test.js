import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEXT_LAYER,
  FONT_FAMILIES,
  fontFamilyCss,
  buildFontString,
  measureText,
  hitText,
  getTextBounds,
} from "../text.js";

function makeCtx(perCharWidth = 10) {
  return {
    font: "",
    textBaseline: "",
    textAlign: "",
    fillStyle: "",
    save() {}, restore() {},
    fillText() {},
    measureText(str) { return { width: String(str || "").length * perCharWidth }; },
  };
}

describe("FONT_FAMILIES", () => {
  it("ships 8 options including inter and playfair", () => {
    expect(FONT_FAMILIES.length).toBeGreaterThanOrEqual(8);
    expect(FONT_FAMILIES.some(f => f.id === "inter")).toBe(true);
    expect(FONT_FAMILIES.some(f => f.id === "playfair")).toBe(true);
  });
});

describe("fontFamilyCss", () => {
  it("maps known id to css stack", () => {
    expect(fontFamilyCss("inter")).toMatch(/Inter/);
  });
  it("passes through an unknown id unchanged", () => {
    expect(fontFamilyCss("Courier, monospace")).toBe("Courier, monospace");
  });
});

describe("buildFontString", () => {
  it("includes size and family", () => {
    const layer = { ...DEFAULT_TEXT_LAYER, fontSize: 24, fontFamily: "inter" };
    const s = buildFontString(layer);
    expect(s).toContain("24px");
    expect(s).toContain("Inter");
  });
  it("adds italic prefix when layer is italic", () => {
    const s = buildFontString({ ...DEFAULT_TEXT_LAYER, italic: true });
    expect(s.startsWith("italic ")).toBe(true);
  });
});

describe("measureText", () => {
  it("returns width equal to longest single line", () => {
    const ctx = makeCtx(5);
    const m = measureText(ctx, { ...DEFAULT_TEXT_LAYER, text: "abc\nabcdef", fontSize: 20 });
    expect(m.lines).toEqual(["abc", "abcdef"]);
    expect(m.width).toBe(30); // "abcdef" × 5
    expect(m.height).toBe(2 * 20 * 1.2);
  });

  it("wraps when maxWidth is set", () => {
    const ctx = makeCtx(10);
    const m = measureText(ctx, { ...DEFAULT_TEXT_LAYER, text: "one two three", fontSize: 20, maxWidth: 60 });
    // Each char is 10px; "one two three" is 13 chars = 130px. Wraps.
    expect(m.lines.length).toBeGreaterThan(1);
  });
});

describe("hitText", () => {
  it("returns true inside bounds and false outside", () => {
    const ctx = makeCtx(10);
    const layer = { ...DEFAULT_TEXT_LAYER, text: "hi", fontSize: 20, ox: 100, oy: 100 };
    const b = getTextBounds(ctx, layer);
    expect(hitText(ctx, layer, b.left + 1, b.top + 1)).toBe(true);
    expect(hitText(ctx, layer, b.right + 10, b.bottom + 10)).toBe(false);
  });
});
