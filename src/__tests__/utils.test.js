import { describe, it, expect } from "vitest";
import {
  clamp, dist, normalizeHexColor, mergePrefs, pushRecentValue,
  pushRecentPreset, getToolRequirement, extractRegion, getAnchorOffset, reorderList,
} from "../utils.js";

describe("clamp", () => {
  it("clamps below min", () => expect(clamp(-5, 0, 10)).toBe(0));
  it("clamps above max", () => expect(clamp(15, 0, 10)).toBe(10));
  it("passes through in range", () => expect(clamp(5, 0, 10)).toBe(5));
});

describe("dist", () => {
  it("computes euclidean distance", () => expect(dist(0, 0, 3, 4)).toBe(5));
  it("returns zero for same point", () => expect(dist(7, 7, 7, 7)).toBe(0));
});

describe("normalizeHexColor", () => {
  it("normalizes 6-digit hex", () => expect(normalizeHexColor("#FF0000", "#000")).toBe("#ff0000"));
  it("expands 3-digit hex", () => expect(normalizeHexColor("#f0f", "#000")).toBe("#ff00ff"));
  it("adds missing hash", () => expect(normalizeHexColor("abc", "#000")).toBe("#aabbcc"));
  it("returns fallback for invalid", () => expect(normalizeHexColor("zzz", "#111")).toBe("#111"));
  it("returns fallback for empty", () => expect(normalizeHexColor("", "#222")).toBe("#222"));
});

describe("mergePrefs", () => {
  it("deep merges objects", () => {
    const base = { a: { b: 1, c: 2 }, d: 3 };
    const partial = { a: { b: 10 } };
    expect(mergePrefs(base, partial)).toEqual({ a: { b: 10, c: 2 }, d: 3 });
  });
  it("returns base for non-object partial", () => {
    expect(mergePrefs({ x: 1 }, null)).toEqual({ x: 1 });
  });
});

describe("pushRecentValue", () => {
  it("prepends and deduplicates", () => {
    expect(pushRecentValue(["a", "b", "c"], "b", 4)).toEqual(["b", "a", "c"]);
  });
  it("respects limit", () => {
    expect(pushRecentValue(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });
});

describe("pushRecentPreset", () => {
  it("deduplicates by dimension key", () => {
    const list = [{ width: 100, height: 100, background: "#fff" }];
    const result = pushRecentPreset(list, { width: 100, height: 100, background: "#fff" }, 4);
    expect(result).toHaveLength(1);
  });
});

describe("getToolRequirement", () => {
  it("returns raster for brush", () => expect(getToolRequirement("brush")).toBe("raster"));
  it("returns vector for rect", () => expect(getToolRequirement("rect")).toBe("vector"));
  it("returns null for move (both)", () => expect(getToolRequirement("move")).toBeNull());
  it("returns null for unknown", () => expect(getToolRequirement("nonexistent")).toBeNull());
});

describe("getAnchorOffset", () => {
  it("returns zero offset for center anchor with same size", () => {
    expect(getAnchorOffset("center", 100, 100, 100, 100)).toEqual({ dx: 0, dy: 0 });
  });
  it("computes nw anchor offset", () => {
    expect(getAnchorOffset("nw", 100, 100, 200, 200)).toEqual({ dx: 0, dy: 0 });
  });
  it("computes se anchor offset", () => {
    expect(getAnchorOffset("se", 100, 100, 200, 200)).toEqual({ dx: 100, dy: 100 });
  });
});

describe("extractRegion", () => {
  it("extracts a sub-rectangle from ImageData", () => {
    const full = new ImageData(4, 4);
    // Fill pixel (2,1) with red
    const idx = (1 * 4 + 2) * 4;
    full.data[idx] = 255;     // R
    full.data[idx + 3] = 255; // A

    const region = extractRegion(full, { x: 1, y: 0, w: 3, h: 2 });
    expect(region.width).toBe(3);
    expect(region.height).toBe(2);
    // (2,1) in full -> (1,1) in region
    const rIdx = (1 * 3 + 1) * 4;
    expect(region.data[rIdx]).toBe(255);
    expect(region.data[rIdx + 3]).toBe(255);
  });
});

describe("reorderList", () => {
  it("moves an item upward into the target slot", () => {
    expect(reorderList(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("moves an item downward into the target slot", () => {
    expect(reorderList(["a", "b", "c", "d"], "b", "d")).toEqual(["a", "c", "b", "d"]);
  });

  it("returns a copy when ids are invalid", () => {
    const list = ["a", "b", "c"];
    expect(reorderList(list, "x", "b")).toEqual(list);
    expect(reorderList(list, "a", "a")).toEqual(list);
  });
});
