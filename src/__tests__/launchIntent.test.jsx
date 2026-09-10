import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PixelForge from "../PixelForge.jsx";
import { renderEditor } from "../render.js";
import {
  LAUNCH_INTENT_KEY,
  consumeLaunchIntent,
  normalizeLaunchIntent,
  writeLaunchIntent,
} from "../launchIntent.js";
import { DEFAULT_BG, DEFAULT_H, DEFAULT_W } from "../constants.js";

vi.mock("../render.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    renderEditor: vi.fn(),
  };
});

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function setViewportSize(width = 1000, height = 800) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: height });
}

function installAnimationFrame() {
  if (globalThis.requestAnimationFrame) return;
  globalThis.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 0);
  globalThis.cancelAnimationFrame = id => window.clearTimeout(id);
  window.requestAnimationFrame = globalThis.requestAnimationFrame;
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
}

describe("launchIntent contract", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips a launcher draft and consumes it exactly once", () => {
    expect(writeLaunchIntent({ preset: "hd", width: 1920, height: 1080, background: "white" })).toBe(true);
    expect(window.sessionStorage.getItem(LAUNCH_INTENT_KEY)).not.toBeNull();
    const intent = consumeLaunchIntent();
    expect(intent).toMatchObject({ preset: "hd", width: 1920, height: 1080, background: DEFAULT_BG, backgroundSupported: true });
    expect(window.sessionStorage.getItem(LAUNCH_INTENT_KEY)).toBeNull();
    expect(consumeLaunchIntent()).toBeNull();
  });

  it("clamps dimensions to the document model and reports unsupported backgrounds", () => {
    const intent = normalizeLaunchIntent({ width: "20000", height: "12", background: "dark" });
    expect(intent.width).toBe(8192);
    expect(intent.height).toBe(64);
    expect(intent.background).toBeNull();
    expect(intent.requestedBackground).toBe("dark");
    expect(intent.backgroundSupported).toBe(false);
  });

  it("falls back to defaults for garbage input", () => {
    expect(normalizeLaunchIntent(null)).toBeNull();
    expect(normalizeLaunchIntent({ width: "abc", height: -4 })).toMatchObject({ width: DEFAULT_W, height: DEFAULT_H, backgroundSupported: true });
    window.sessionStorage.setItem(LAUNCH_INTENT_KEY, "{not json");
    expect(consumeLaunchIntent()).toBeNull();
    expect(window.sessionStorage.getItem(LAUNCH_INTENT_KEY)).toBeNull();
  });
});

describe("editor honors launch intent", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setViewportSize();
    installAnimationFrame();
    globalThis.ResizeObserver = ResizeObserverMock;
    window.ResizeObserver = ResizeObserverMock;
    renderEditor.mockClear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("opens the document size chosen in the launcher", async () => {
    writeLaunchIntent({ preset: "story", width: 1080, height: 1920, background: "white" });
    await act(async () => {
      render(<PixelForge />);
    });
    await waitFor(() => expect(screen.getAllByText("1080 × 1920").length).toBeGreaterThan(0));
    expect(window.sessionStorage.getItem(LAUNCH_INTENT_KEY)).toBeNull();
  });

  it("opens the default document when no intent is present", async () => {
    await act(async () => {
      render(<PixelForge />);
    });
    await waitFor(() => expect(screen.getAllByText(`${DEFAULT_W} × ${DEFAULT_H}`).length).toBeGreaterThan(0));
  });
});
