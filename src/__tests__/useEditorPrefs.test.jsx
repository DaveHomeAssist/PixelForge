import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useEditorPrefs from "../hooks/useEditorPrefs.js";
import { DEFAULT_PREFS, PREFS_KEY } from "../constants.js";

function makeProps(overrides = {}) {
  return {
    brushSize: 10,
    brushOpacity: 1,
    strokeW: 2,
    fillOn: true,
    strokeOn: true,
    color1: "#2a6f97",
    color2: "#16324f",
    tool: "brush",
    mobilePanelTab: "next",
    setBrushSize: vi.fn(),
    setBrushOpacity: vi.fn(),
    setStrokeW: vi.fn(),
    setFillOn: vi.fn(),
    setStrokeOn: vi.fn(),
    setColor1: vi.fn(),
    setColor2: vi.fn(),
    setDocForm: vi.fn(),
    setResizeForm: vi.fn(),
    setMobilePanelTab: vi.fn(),
    ...overrides,
  };
}

describe("useEditorPrefs", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hydrates editor state from stored preferences", async () => {
    const storedPrefs = {
      ...DEFAULT_PREFS,
      uiPrefs: {
        ...DEFAULT_PREFS.uiPrefs,
        mobileTab: "layers",
      },
      toolPrefs: {
        ...DEFAULT_PREFS.toolPrefs,
        brushSize: 24,
        brushOpacity: 0.45,
        strokeWidth: 7,
        fillOn: false,
        strokeOn: false,
        recentColors: ["#abcdef", "#123456"],
      },
      docPrefs: {
        ...DEFAULT_PREFS.docPrefs,
        lastNewDoc: { width: 1440, height: 900, background: "#f4efe6" },
        lastResizeAnchor: "se",
      },
    };
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(storedPrefs));

    const props = makeProps();
    const { result } = renderHook((hookProps) => useEditorPrefs(hookProps), {
      initialProps: props,
    });

    await waitFor(() => {
      expect(result.current.prefs.toolPrefs.brushSize).toBe(24);
    });

    expect(props.setBrushSize).toHaveBeenCalledWith(24);
    expect(props.setBrushOpacity).toHaveBeenCalledWith(0.45);
    expect(props.setStrokeW).toHaveBeenCalledWith(7);
    expect(props.setFillOn).toHaveBeenCalledWith(false);
    expect(props.setStrokeOn).toHaveBeenCalledWith(false);
    expect(props.setColor1).toHaveBeenCalledWith("#abcdef");
    expect(props.setColor2).toHaveBeenCalledWith("#123456");
    expect(props.setDocForm).toHaveBeenCalledWith({
      width: 1440,
      height: 900,
      background: "#f4efe6",
    });
    expect(props.setMobilePanelTab).toHaveBeenCalledWith("layers");

    const resizeUpdate = props.setResizeForm.mock.calls[0][0];
    expect(resizeUpdate({ width: 200, height: 200, anchor: "center" })).toEqual({
      width: 200,
      height: 200,
      anchor: "se",
    });
  });

  it("persists current working preferences back to localStorage", async () => {
    const initialProps = makeProps({
      brushSize: 14,
      brushOpacity: 0.6,
      strokeW: 5,
      fillOn: false,
      color1: "#111111",
      color2: "#eeeeee",
      mobilePanelTab: "palette",
    });

    const { rerender } = renderHook((hookProps) => useEditorPrefs(hookProps), {
      initialProps,
    });

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(PREFS_KEY));
      expect(persisted.toolPrefs.brushSize).toBe(14);
      expect(persisted.toolPrefs.brushOpacity).toBe(0.6);
      expect(persisted.toolPrefs.strokeWidth).toBe(5);
      expect(persisted.toolPrefs.fillOn).toBe(false);
      expect(persisted.uiPrefs.mobileTab).toBe("palette");
      expect(persisted.toolPrefs.recentColors.slice(0, 2)).toEqual(["#eeeeee", "#111111"]);
    });

    rerender({
      ...initialProps,
      brushSize: 22,
      tool: "eraser",
      mobilePanelTab: "layers",
    });

    await waitFor(() => {
      const persisted = JSON.parse(window.localStorage.getItem(PREFS_KEY));
      expect(persisted.toolPrefs.recentBrushSizes[0]).toBe(22);
      expect(persisted.uiPrefs.mobileTab).toBe("layers");
    });
  });

  it("recovers from invalid stored JSON by falling back to defaults", async () => {
    window.localStorage.setItem(PREFS_KEY, "{bad json");
    const props = makeProps();

    const { result } = renderHook((hookProps) => useEditorPrefs(hookProps), {
      initialProps: props,
    });

    await waitFor(() => {
      expect(result.current.prefs.toolPrefs.brushSize).toBe(DEFAULT_PREFS.toolPrefs.brushSize);
    });

    expect(props.setBrushSize).toHaveBeenCalledWith(DEFAULT_PREFS.toolPrefs.brushSize);
    expect(props.setColor1).toHaveBeenCalledWith(DEFAULT_PREFS.toolPrefs.recentColors[0]);
    expect(props.setColor2).toHaveBeenCalledWith(DEFAULT_PREFS.toolPrefs.recentColors[1]);

    const persisted = JSON.parse(window.localStorage.getItem(PREFS_KEY));
    expect(persisted.toolPrefs.brushSize).toBe(DEFAULT_PREFS.toolPrefs.brushSize);
  });
});
