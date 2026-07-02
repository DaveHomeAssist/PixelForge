import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LayersSection from "../components/LayersSection.jsx";

const layers = [
  {
    id: "background",
    name: "Background",
    type: "raster",
    visible: true,
    locked: false,
    blend: "source-over",
    opacity: 1,
  },
  {
    id: "headline",
    name: "Headline",
    type: "text",
    visible: false,
    locked: true,
    blend: "multiply",
    opacity: 0.8,
  },
];

function renderLayers(overrides = {}) {
  const props = {
    feedbackClass: () => "",
    layers,
    activeLayer: layers[0],
    activeId: "background",
    layerNameInput: "Background",
    setLayerNameInput: vi.fn(),
    commitActiveLayerName: vi.fn(),
    toggleLock: vi.fn(),
    duplicateActiveLayer: vi.fn(),
    mergeLayerDown: vi.fn(),
    rasterizeLayer: vi.fn(),
    canMergeDown: true,
    addLayer: vi.fn(),
    delLayer: vi.fn(),
    canMoveUp: true,
    canMoveDown: true,
    moveLayer: vi.fn(),
    setBlend: vi.fn(),
    layerOpacityValue: 100,
    beginLayerOpacityEdit: vi.fn(),
    handleLayerOpacityInput: vi.fn(),
    commitLayerOpacityEdit: vi.fn(),
    dragLayerId: null,
    dragOverLayerId: null,
    intentLayerId: null,
    intentLayerTone: null,
    suggestedLayerId: null,
    setActiveId: vi.fn(),
    onLayerDragStart: vi.fn(),
    onLayerDragEnd: vi.fn(),
    onLayerDragEnter: vi.fn(),
    onLayerDragLeave: vi.fn(),
    onLayerDrop: vi.fn(),
    toggleVis: vi.fn(),
    onLayerContextMenu: vi.fn(),
    onLayerLongPressStart: vi.fn(),
    onLayerLongPressCancel: vi.fn(),
    onToggle: vi.fn(),
    ...overrides,
  };
  render(<LayersSection {...props} />);
  return props;
}

describe("LayersSection", () => {
  afterEach(() => cleanup());

  it("exposes layer rows as keyboard-selectable buttons", () => {
    const props = renderLayers();
    const headlineRow = screen.getByRole("button", {
      name: "Select Headline layer, text, hidden, locked",
    });
    const backgroundRow = screen.getByRole("button", {
      name: "Select Background layer, raster, visible, unlocked",
    });

    expect(headlineRow.getAttribute("tabindex")).toBe("0");
    expect(headlineRow.getAttribute("aria-pressed")).toBe("false");
    expect(backgroundRow.getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(headlineRow, { key: "Enter" });
    expect(props.setActiveId).toHaveBeenCalledWith("headline");

    props.setActiveId.mockClear();
    fireEvent.keyDown(headlineRow, { key: " " });
    expect(props.setActiveId).toHaveBeenCalledWith("headline");
  });

  it("keeps nested visibility and lock controls separate from row selection", () => {
    const props = renderLayers();
    const showButton = screen.getByRole("button", { name: "Show Headline layer" });
    const unlockButton = screen.getByRole("button", { name: "Unlock Headline layer" });

    fireEvent.click(showButton);
    expect(props.toggleVis).toHaveBeenCalledWith("headline");
    expect(props.setActiveId).not.toHaveBeenCalled();

    fireEvent.click(unlockButton);
    expect(props.toggleLock).toHaveBeenCalledWith("headline");
    expect(props.setActiveId).not.toHaveBeenCalled();
  });
});
