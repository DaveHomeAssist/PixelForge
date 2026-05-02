import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TextPropertiesSection from "../components/TextPropertiesSection.jsx";

function renderTextProps(overrides = {}) {
  const { activeLayer: activeLayerOverrides = {}, ...rest } = overrides;
  const props = {
    activeLayer: {
      id: "text-1",
      type: "text",
      text: "Text",
      fontFamily: "Inter, -apple-system, sans-serif",
      fontSize: 32,
      fontWeight: 400,
      italic: false,
      color: "#123456",
      align: "left",
      ...activeLayerOverrides,
    },
    updateTextLayer: vi.fn(),
    startEditingText: vi.fn(),
    ...rest,
  };
  render(<TextPropertiesSection {...props} />);
  return props;
}

describe("TextPropertiesSection", () => {
  it.each([
    ["1", 1],
    ["64", 64],
    ["256", 256],
    ["512", 512],
  ])("commits font size %s", (rawValue, expected) => {
    const props = renderTextProps();

    fireEvent.change(screen.getByLabelText("Font size value"), { target: { value: rawValue } });

    expect(props.updateTextLayer).toHaveBeenCalledWith("text-1", { fontSize: expected });
  });

  it("clamps text size to the supported range", () => {
    const props = renderTextProps();

    fireEvent.change(screen.getByLabelText("Font size value"), { target: { value: "900" } });
    fireEvent.change(screen.getByLabelText("Font size value"), { target: { value: "0" } });

    expect(props.updateTextLayer).toHaveBeenNthCalledWith(1, "text-1", { fontSize: 512 });
    expect(props.updateTextLayer).toHaveBeenNthCalledWith(2, "text-1", { fontSize: 1 });
  });

  it("rejects non-numeric font size input without mutating", () => {
    const props = renderTextProps();

    fireEvent.change(screen.getByLabelText("Font size value"), { target: { value: "not-a-size" } });

    expect(props.updateTextLayer).not.toHaveBeenCalled();
  });

  it("keeps slider and number input bound to the active layer size", () => {
    renderTextProps({ activeLayer: { fontSize: 256 } });

    expect(screen.getByLabelText("Font size").value).toBe("256");
    expect(screen.getByLabelText("Font size value").valueAsNumber).toBe(256);
  });
});
