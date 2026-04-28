import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PixelForge from "../PixelForge.jsx";
import { renderEditor } from "../render.js";

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

async function renderEditorApp() {
  await act(async () => {
    render(<PixelForge />);
  });
  await act(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
  await waitFor(() => expect(renderEditor).toHaveBeenCalled());
  await waitFor(() => expect(latestRenderArgs().zoom).toBeLessThan(1));
}

function latestRenderArgs() {
  return [...renderEditor.mock.calls].reverse().find(([args]) => args?.pan)?.[0];
}

describe("PixelForge keyboard shortcuts", () => {
  beforeEach(() => {
    setViewportSize();
    installAnimationFrame();
    globalThis.ResizeObserver = ResizeObserverMock;
    window.ResizeObserver = ResizeObserverMock;
    renderEditor.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("fits the document with Cmd+0", async () => {
    await renderEditorApp();
    const initialZoom = latestRenderArgs().zoom;

    fireEvent.keyDown(window, { key: "=", metaKey: true });
    await waitFor(() => expect(latestRenderArgs().zoom).toBeGreaterThan(initialZoom));

    fireEvent.keyDown(window, { key: "0", metaKey: true });

    await waitFor(() => expect(latestRenderArgs().zoom).toBeCloseTo(initialZoom));
  });

  it("zooms in with Cmd+= and zooms out with Cmd+-", async () => {
    await renderEditorApp();
    const initialZoom = latestRenderArgs().zoom;

    fireEvent.keyDown(window, { key: "=", metaKey: true });
    await waitFor(() => expect(latestRenderArgs().zoom).toBeCloseTo(initialZoom * 1.25));

    fireEvent.keyDown(window, { key: "-", metaKey: true });
    await waitFor(() => expect(latestRenderArgs().zoom).toBeCloseTo(initialZoom));
  });

  it("pans the viewport with ArrowRight when nothing is selected", async () => {
    await renderEditorApp();
    const initialPan = latestRenderArgs().pan;

    fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      const latestPan = latestRenderArgs().pan;
      expect(latestPan.x).toBe(initialPan.x - 16);
    });
  });

  it("shows grab feedback while Space is held", async () => {
    await renderEditorApp();
    const viewport = document.querySelector(".pf-viewport");

    fireEvent.keyDown(window, { code: "Space", key: " " });
    await waitFor(() => expect(viewport.style.cursor).toBe("grab"));

    fireEvent.keyUp(window, { code: "Space", key: " " });
    await waitFor(() => expect(viewport.style.cursor).toBe("crosshair"));
  });

  it("renders a brush cursor overlay for drawing tools", async () => {
    await renderEditorApp();

    expect(screen.getByTestId("pf-brush-cursor")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Eraser (E)"));
    expect(screen.getByTestId("pf-brush-cursor")).toBeTruthy();
  });
});
