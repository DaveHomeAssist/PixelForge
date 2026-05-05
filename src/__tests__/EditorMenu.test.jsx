import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditorMenu from "../components/EditorMenu.jsx";

/**
 * EditorMenu tests
 *
 * As of PR 3 of the redesign cycle, EditorMenu only renders the mobile
 * trigger and its slide-out sheet. Desktop dropdowns (File / Edit / Image /
 * View) and Save / Export buttons moved to TopBar (see TopBar.test.jsx).
 * These tests cover the surviving mobile-sheet surface.
 */
function renderMenu(overrides = {}) {
  const props = {
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
      canDeselect: true,
      deselect: vi.fn(),
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
    hasArtwork: true,
    undoN: 1,
    redoN: 1,
    saveButtonLabel: "Save",
    canUseFileSave: true,
    ...overrides,
  };
  render(<EditorMenu {...props} />);
  return props;
}

describe("EditorMenu (mobile sheet)", () => {
  afterEach(() => cleanup());

  it("opens the mobile sheet when the menu trigger is clicked", () => {
    renderMenu();
    expect(screen.queryByRole("dialog", { name: /editor menu/i })).toBeNull();
    fireEvent.click(screen.getByLabelText(/open menu/i));
    expect(screen.getByRole("dialog", { name: /editor menu/i })).toBeTruthy();
  });

  it("invokes handleImportImage from the mobile sheet and closes it", () => {
    const props = renderMenu();
    fireEvent.click(screen.getByLabelText(/open menu/i));
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    expect(props.handleImportImage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: /editor menu/i })).toBeNull();
  });

  it("renders the Deselect button when a marquee is active", () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText(/open menu/i));
    expect(screen.getByRole("button", { name: /deselect/i })).toBeTruthy();
  });

  it("hides the Deselect button when no marquee is active", () => {
    renderMenu({
      editActions: { canDeselect: false, deselect: vi.fn(), adjust: vi.fn(), filter: vi.fn() },
    });
    fireEvent.click(screen.getByLabelText(/open menu/i));
    expect(screen.queryByRole("button", { name: /deselect/i })).toBeNull();
  });

  it("toggles the grid via the workspace action shortcut", () => {
    const props = renderMenu();
    fireEvent.click(screen.getByLabelText(/open menu/i));
    fireEvent.click(screen.getByRole("button", { name: /^grid$/i }));
    expect(props.workspaceActions.toggle).toHaveBeenCalledWith("showGrid");
  });
});
