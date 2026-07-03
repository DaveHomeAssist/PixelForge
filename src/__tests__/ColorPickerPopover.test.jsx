import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ColorPickerPopover from "../components/ColorPickerPopover.jsx";
import { formatHex, hsvToRgb, parseHex, rgbToHsv } from "../colorOps.js";

function renderPicker(overrides = {}) {
  const props = {
    open: true,
    value: "#336699",
    anchorRect: { left: 12, right: 44, top: 12, bottom: 44 },
    onChange: vi.fn(),
    onClose: vi.fn(),
    palettesApi: {
      recents: ["#112233"],
      palettes: [{ id: "p1", name: "Saved", colors: ["#445566"] }],
      addRecent: vi.fn(),
      savePalette: vi.fn(),
    },
    ...overrides,
  };
  render(<ColorPickerPopover {...props} />);
  return props;
}

describe("ColorPickerPopover", () => {
  afterEach(() => cleanup());

  it("renders all four tabs", () => {
    renderPicker();

    expect(screen.getByRole("tab", { name: "HEX" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "RGB" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "HSL" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "HSV" })).toBeTruthy();
  });

  it("keeps HEX, RGB, HSL, and HSV values in sync", () => {
    const props = renderPicker();

    fireEvent.click(screen.getByRole("tab", { name: "RGB" }));
    expect(screen.getByLabelText("Red").value).toBe("51");
    fireEvent.change(screen.getByLabelText("Red"), { target: { value: "255" } });
    expect(props.onChange).toHaveBeenLastCalledWith("#ff6699");

    cleanup();
    renderPicker({ value: "#ff6699", onChange: props.onChange });
    fireEvent.click(screen.getByRole("tab", { name: "HSV" }));
    expect(screen.getByLabelText("HSV value").value).toBe("100");
    fireEvent.change(screen.getByLabelText("HSV hue"), { target: { value: "120" } });
    expect(props.onChange).toHaveBeenLastCalledWith("#66ff66");

    cleanup();
    renderPicker({ value: "#0000ff", onChange: props.onChange });
    fireEvent.click(screen.getByRole("tab", { name: "HSL" }));
    expect(screen.getByLabelText("HSL hue").value).toBe("240");
    fireEvent.click(screen.getByRole("tab", { name: "HEX" }));
    expect(screen.getByLabelText("HEX value").value).toBe("#0000ff");
  });

  it("dismisses on Escape and outside click", () => {
    const props = renderPicker();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("adjusts saturation and value from the keyboard", () => {
    const props = renderPicker();
    const sv = screen.getByRole("application", { name: /saturation 67 percent, value 60 percent/i });
    const hsv = rgbToHsv(...Object.values(parseHex("#336699")));

    fireEvent.keyDown(sv, { key: "ArrowRight" });
    expect(props.onChange).toHaveBeenLastCalledWith(formatHex(hsvToRgb(hsv.h, hsv.s + 0.01, hsv.v)));

    fireEvent.keyDown(sv, { key: "ArrowUp", shiftKey: true });
    expect(props.onChange).toHaveBeenLastCalledWith(formatHex(hsvToRgb(hsv.h, hsv.s, hsv.v + 0.1)));

    fireEvent.keyDown(sv, { key: "Home" });
    expect(props.onChange).toHaveBeenLastCalledWith(formatHex(hsvToRgb(hsv.h, 0, hsv.v)));

    expect(screen.queryByRole("slider", { name: /saturation/i })).toBeNull();
  });

  it("does not hijack arrow keys while editing color inputs", () => {
    renderPicker();
    const hexInput = screen.getByLabelText("HEX value");

    expect(fireEvent.keyDown(hexInput, { key: "ArrowLeft" })).toBe(true);
    expect(fireEvent.keyDown(hexInput, { key: "ArrowRight" })).toBe(true);
  });
});
