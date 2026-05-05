import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TopBar from "../components/TopBar.jsx";

function renderTopBar(overrides = {}) {
  const props = {
    docName: "Untitled",
    zoom: 1,
    setZoom: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomFit: vi.fn(),
    theme: "light",
    onToggleTheme: vi.fn(),
    onOpenCommand: vi.fn(),
    onOpenTweaks: vi.fn(),
    onSave: vi.fn(),
    onExport: vi.fn(),
    isDirty: false,
    savedAt: "10:00",
    docW: 1200,
    docH: 800,
    saveButtonLabel: "Save",
    saveButtonTitle: "Save project",
    fileItems: [
      { key: "new", label: "New Document", run: vi.fn() },
      { key: "open", label: "Open Project", run: vi.fn() },
    ],
    editItems: [
      { key: "undo", label: "Undo", kbd: "Cmd Z", run: vi.fn() },
    ],
    imageItems: [
      { key: "resize", label: "Resize Canvas", run: vi.fn() },
    ],
    viewItems: [
      { key: "fit", label: "Fit View", run: vi.fn() },
    ],
    ...overrides,
  };
  render(<TopBar {...props} />);
  return props;
}

describe("TopBar", () => {
  afterEach(() => cleanup());

  it("renders the brand text 'Pixel Forge' (two words)", () => {
    renderTopBar();
    expect(screen.getByText("Pixel Forge")).toBeTruthy();
  });

  it("renders the document name when supplied", () => {
    renderTopBar({ docName: "Layer 1" });
    expect(screen.getByText("Layer 1")).toBeTruthy();
  });

  it("fires onToggleTheme when the theme chip is clicked", () => {
    const props = renderTopBar();
    fireEvent.click(screen.getByLabelText(/switch to dark theme/i));
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("shows a sun icon when the theme is dark", () => {
    renderTopBar({ theme: "dark" });
    expect(screen.getByLabelText(/switch to light theme/i)).toBeTruthy();
  });

  it("fires onOpenCommand when the Cmd+K chip is clicked", () => {
    const props = renderTopBar();
    fireEvent.click(screen.getByTitle(/command palette/i));
    expect(props.onOpenCommand).toHaveBeenCalledTimes(1);
  });

  it("fires onOpenTweaks when the Sliders chip is clicked", () => {
    const props = renderTopBar();
    fireEvent.click(screen.getByLabelText(/open tweaks/i));
    expect(props.onOpenTweaks).toHaveBeenCalledTimes(1);
  });

  it("opens the File menu on click and runs the chosen item", () => {
    const newRun = vi.fn();
    const props = renderTopBar({
      fileItems: [{ key: "new", label: "New Document", run: newRun }],
    });
    expect(screen.queryByRole("menu", { name: /file menu/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^file$/i }));
    expect(screen.getByRole("menu", { name: /file menu/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /new document/i }));
    expect(newRun).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("fires onSave and onExport when the toolbar buttons are clicked", () => {
    const props = renderTopBar();
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    expect(props.onExport).toHaveBeenCalledTimes(1);
  });

  it("displays the document dimensions in the dim chip", () => {
    renderTopBar({ docW: 1024, docH: 768 });
    expect(screen.getByLabelText(/document dimensions/i).textContent).toMatch(/1024.*×.*768/);
  });

  it("fires zoom callbacks when the zoom group buttons are clicked", () => {
    const props = renderTopBar({ zoom: 0.5 });
    fireEvent.click(screen.getByLabelText(/zoom in/i));
    fireEvent.click(screen.getByLabelText(/zoom out/i));
    fireEvent.click(screen.getByLabelText(/fit document/i));
    expect(props.onZoomIn).toHaveBeenCalledTimes(1);
    expect(props.onZoomOut).toHaveBeenCalledTimes(1);
    expect(props.onZoomFit).toHaveBeenCalledTimes(1);
  });

  it("renders the zoom percentage rounded to the nearest integer", () => {
    renderTopBar({ zoom: 0.752 });
    expect(screen.getByText("75%")).toBeTruthy();
  });
});
