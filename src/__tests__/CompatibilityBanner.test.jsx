import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CompatibilityBanner from "../components/CompatibilityBanner.jsx";

const brush = { id: "brush", label: "Brush", raster: true, vector: false, text: false };
const textTool = { id: "text", label: "Text", raster: false, vector: false, text: true };

function renderBanner(overrides = {}) {
  const props = {
    activeLayer: { id: "vector-1", name: "Shapes", type: "vector", locked: false },
    toolMeta: brush,
    toolCompatible: false,
    requiredLayerType: "raster",
    suggestedLayer: { id: "raster-1", name: "Paint", type: "raster", locked: false },
    focusLayerId: vi.fn(),
    addLayer: vi.fn(),
    toggleLock: vi.fn(),
    setPanelTab: vi.fn(),
    ...overrides,
  };
  const result = render(<CompatibilityBanner {...props} />);
  return { ...props, ...result };
}

describe("CompatibilityBanner", () => {
  it("offers a compatible layer switch for tool mismatches", () => {
    const props = renderBanner();

    expect(screen.getByText("Brush needs raster layers")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Switch To Paint" }));

    expect(props.focusLayerId).toHaveBeenCalledWith("raster-1");
  });

  it("offers to create the required layer type when no target exists", () => {
    const props = renderBanner({
      toolMeta: textTool,
      requiredLayerType: "text",
      suggestedLayer: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Text Layer" }));

    expect(props.addLayer).toHaveBeenCalledWith("text");
  });

  it("offers to unlock the active layer when a tool is blocked by locking", () => {
    const props = renderBanner({
      activeLayer: { id: "raster-1", name: "Paint", type: "raster", locked: true },
      toolCompatible: true,
      suggestedLayer: null,
    });

    expect(screen.getByText("Paint is locked")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unlock Layer" }));

    expect(props.toggleLock).toHaveBeenCalledWith("raster-1");
  });

  it("opens the layers tab from the banner", () => {
    const props = renderBanner();

    fireEvent.click(screen.getByRole("button", { name: "View Layers" }));

    expect(props.setPanelTab).toHaveBeenCalledWith("layers");
  });

  it("does not render when the current layer is editable and compatible", () => {
    const { container } = renderBanner({
      activeLayer: { id: "raster-1", name: "Paint", type: "raster", locked: false },
      toolCompatible: true,
      suggestedLayer: null,
    });

    expect(container.firstChild).toBeNull();
  });
});
