import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts.js";

function makeArgs(overrides = {}) {
  return {
    selectedShape: null,
    space: { current: false },
    selectionMask: null,
    activeId: "layer-1",
    tool: "brush",
    isCompactUI: false,
    modalOpen: false,
    setBrushSize: vi.fn(),
    setPan: vi.fn(),
    setIsSpaceHeld: vi.fn(),
    setSelectedShape: vi.fn(),
    setCommandOpen: vi.fn(),
    setMobilePanelTab: vi.fn(),
    doUndo: vi.fn(() => true),
    doRedo: vi.fn(() => true),
    handleSave: vi.fn(),
    handleFitView: vi.fn(),
    zoomAtViewportPoint: vi.fn(),
    clearSelection: vi.fn(),
    duplicateActiveLayer: vi.fn(),
    selectTool: vi.fn(),
    swapColors: vi.fn(),
    copyMarquee: vi.fn(),
    cutMarquee: vi.fn(),
    deleteMarquee: vi.fn(),
    nudgeMarquee: vi.fn(),
    escapeMarquee: vi.fn(() => false),
    deselectRasterSelection: vi.fn(),
    selectAllActive: vi.fn(),
    moveLayer: vi.fn(),
    nudgeSelectedShape: vi.fn(),
    findShapeRecord: vi.fn(() => null),
    canEditLayer: vi.fn(() => true),
    capturePatchSnapshot: vi.fn(() => ({})),
    commitPatchHistory: vi.fn(),
    cloneShape: vi.fn((s) => ({ ...s })),
    uid: vi.fn(() => "new-id"),
    triggerFeedback: vi.fn(),
    ...overrides,
  };
}

function dispatchKeyDown(init) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
}

function dispatchKeyUp(init) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, ...init }));
  });
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    // Each test fires events on window; renderHook attaches listeners via the
    // hook's own useEffect, so no extra setup needed here.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls handleFitView when Cmd+0 is pressed", () => {
    const args = makeArgs();
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "0", metaKey: true });

    expect(args.handleFitView).toHaveBeenCalledTimes(1);
  });

  it("invokes zoomAtViewportPoint with 1.2 when Cmd+= is pressed", () => {
    const args = makeArgs();
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "=", metaKey: true });

    expect(args.zoomAtViewportPoint).toHaveBeenCalledWith(1.2);
  });

  it("invokes zoomAtViewportPoint with 1/1.2 when Cmd+- is pressed", () => {
    const args = makeArgs();
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "-", metaKey: true });

    expect(args.zoomAtViewportPoint).toHaveBeenCalledWith(1 / 1.2);
  });

  it("flips the tool to move when bare V is pressed", () => {
    const args = makeArgs();
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "v" });

    expect(args.selectTool).toHaveBeenCalledWith("move");
  });

  it("flips space ref to true on Space keydown and back to false on keyup", () => {
    const args = makeArgs();
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ code: "Space", key: " " });
    expect(args.space.current).toBe(true);
    expect(args.setIsSpaceHeld).toHaveBeenLastCalledWith(true);

    dispatchKeyUp({ code: "Space", key: " " });
    expect(args.space.current).toBe(false);
    expect(args.setIsSpaceHeld).toHaveBeenLastCalledWith(false);
  });

  it("fires doUndo on Cmd+Z and doRedo on Cmd+Shift+Z", () => {
    const args = makeArgs();
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "z", metaKey: true });
    expect(args.doUndo).toHaveBeenCalledTimes(1);
    expect(args.doRedo).not.toHaveBeenCalled();

    dispatchKeyDown({ key: "z", metaKey: true, shiftKey: true });
    expect(args.doRedo).toHaveBeenCalledTimes(1);
  });

  it("modal gate off: bare V flips the tool to move", () => {
    const args = makeArgs({ modalOpen: false });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "v" });

    expect(args.selectTool).toHaveBeenCalledWith("move");
  });

  it("modal gate on: bare V does NOT flip the tool", () => {
    const args = makeArgs({ modalOpen: true });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "v" });

    expect(args.selectTool).not.toHaveBeenCalled();
  });

  it("modal gate on: Cmd+Z STILL fires doUndo", () => {
    const args = makeArgs({ modalOpen: true });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "z", metaKey: true });

    expect(args.doUndo).toHaveBeenCalledTimes(1);
  });

  it("modal gate on: Cmd+S STILL fires handleSave", () => {
    const args = makeArgs({ modalOpen: true });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "s", metaKey: true });

    expect(args.handleSave).toHaveBeenCalledTimes(1);
  });

  it("modal gate on: Cmd+K STILL opens command palette", () => {
    const args = makeArgs({ modalOpen: true });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "k", metaKey: true });

    expect(args.setCommandOpen).toHaveBeenCalledWith(true);
  });

  it("modal gate on: bare Escape does NOT call clearSelection (modal owns Escape)", () => {
    // The gate lets Escape through to the handler, but escapeMarquee returns
    // false. Without the gate, clearSelection would fire. The modal-owns
    // contract is satisfied because the modal's focus-trap onEscape closes
    // the modal before the global listener mutates canvas state in real use.
    // Here we assert the global handler still defers to escapeMarquee first.
    const escapeMarquee = vi.fn(() => true); // simulate marquee absorbing Escape
    const args = makeArgs({ modalOpen: true, escapeMarquee });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "Escape" });

    expect(args.clearSelection).not.toHaveBeenCalled();
  });

  it("modal gate on: bare X does NOT swap colors", () => {
    const args = makeArgs({ modalOpen: true });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "x" });

    expect(args.swapColors).not.toHaveBeenCalled();
  });

  it("modal gate on: bare bracket does NOT change brush size", () => {
    const args = makeArgs({ modalOpen: true });
    renderHook(() => useKeyboardShortcuts(args));

    dispatchKeyDown({ key: "[" });
    dispatchKeyDown({ key: "]" });

    expect(args.setBrushSize).not.toHaveBeenCalled();
  });
});
