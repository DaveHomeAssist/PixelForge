import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditorMenu from "../components/EditorMenu.jsx";

function renderMenu(overrides = {}) {
  const props = {
    feedbackClass: () => "",
    handleNewDocument: vi.fn(),
    handleImportImage: vi.fn(),
    handlePaste: vi.fn(),
    onResizeDocument: vi.fn(),
    handleLoad: vi.fn(),
    handleSave: vi.fn(),
    handleOpenExport: vi.fn(),
    handleQuickExport: vi.fn(),
    handleOpenAIGenerate: vi.fn(),
    imageActions: {
      canCrop: true,
      crop: vi.fn(),
      trim: vi.fn(),
      rotate: vi.fn(),
      flip: vi.fn(),
    },
    editActions: {
      adjust: vi.fn(),
      filter: vi.fn(),
    },
    workspaceActions: {
      toggle: vi.fn(),
    },
    openCommandPalette: vi.fn(),
    openHistoryPanel: vi.fn(),
    doUndo: vi.fn(),
    doRedo: vi.fn(),
    toolMeta: { label: "Brush" },
    activeLayer: { name: "Layer 1" },
    docW: 1200,
    docH: 800,
    isDirty: true,
    lastSavedAt: null,
    hasArtwork: true,
    undoN: 1,
    redoN: 1,
    zoom: 1,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    handleFitView: vi.fn(),
    saveButtonLabel: "Save",
    saveButtonTitle: "Save project",
    canUseFileSave: true,
    ...overrides,
  };

  render(<EditorMenu {...props} />);
  return props;
}

describe("EditorMenu", () => {
  afterEach(() => cleanup());

  it("groups file actions inside a dropdown menu", () => {
    const props = renderMenu();

    expect(screen.queryByRole("menu", { name: "File menu" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /file/i }));

    expect(screen.getByRole("menu", { name: "File menu" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /import image/i }));

    expect(props.handleImportImage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu", { name: "File menu" })).toBeNull();
  });

  it("keeps secondary image and view actions available from menus", () => {
    const props = renderMenu();

    fireEvent.click(screen.getByRole("button", { name: /image/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /rotate 90/i }));
    expect(props.imageActions.rotate).toHaveBeenCalledWith(90);

    fireEvent.click(screen.getByRole("button", { name: /view/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /toggle grid/i }));
    expect(props.workspaceActions.toggle).toHaveBeenCalledWith("showGrid");
  });
});
