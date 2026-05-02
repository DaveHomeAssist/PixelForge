import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdjustModal, { ADJUSTMENT_CONFIGS } from "../components/AdjustModal.jsx";

function sourceImageData() {
  return new ImageData(new Uint8ClampedArray([
    10, 20, 30, 255, 100, 110, 120, 255,
    200, 210, 220, 255, 40, 50, 60, 255,
  ]), 2, 2);
}

describe("AdjustModal", () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancelRaf = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = vi.fn((callback) => window.setTimeout(callback, 0));
    globalThis.cancelAnimationFrame = vi.fn((id) => window.clearTimeout(id));
  });

  afterEach(() => {
    cleanup();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
  });

  it("renders each adjustment kind with an Amount control", () => {
    for (const kind of Object.keys(ADJUSTMENT_CONFIGS)) {
      const { unmount } = render(
        <AdjustModal
          kind={kind}
          open
          sourceImageData={sourceImageData()}
          onCancel={vi.fn()}
          onCommit={vi.fn()}
        />
      );

      expect(screen.getByRole("dialog", { name: `${ADJUSTMENT_CONFIGS[kind].title} adjustment` })).toBeTruthy();
      expect(screen.getByRole("slider", { name: "Amount" })).toBeTruthy();
      unmount();
    }
  });

  it("updates the canvas preview when the slider changes", async () => {
    render(
      <AdjustModal
        kind="brightness"
        open
        sourceImageData={sourceImageData()}
        onCancel={vi.fn()}
        onCommit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("slider", { name: "Amount" }), { target: { value: "20" } });

    const canvas = screen.getByLabelText("Brightness preview");
    await waitFor(() => {
      const data = canvas.getContext("2d").getImageData(0, 0, 1, 1).data;
      expect(Array.from(data)).toEqual([30, 40, 50, 255]);
    });
  });

  it("cancels without committing", () => {
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    render(
      <AdjustModal
        kind="contrast"
        open
        sourceImageData={sourceImageData()}
        onCancel={onCancel}
        onCommit={onCommit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits ImageData with the same source dimensions", () => {
    const onCommit = vi.fn();
    render(
      <AdjustModal
        kind="hue"
        open
        sourceImageData={sourceImageData()}
        onCancel={vi.fn()}
        onCommit={onCommit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]).toBeInstanceOf(ImageData);
    expect(onCommit.mock.calls[0][0].width).toBe(2);
    expect(onCommit.mock.calls[0][0].height).toBe(2);
  });
});
