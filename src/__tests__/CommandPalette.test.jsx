import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommandPalette from "../components/CommandPalette.jsx";

function buildCommands() {
  return [
    { id: "cmd-undo", label: "Undo", group: "Edit", run: vi.fn() },
    { id: "cmd-redo", label: "Redo", group: "Edit", run: vi.fn() },
    { id: "cmd-grid", label: "Show Grid", group: "View", run: vi.fn() },
    { id: "cmd-dark", label: "Dark Mode", group: "View", run: vi.fn() },
  ];
}

function renderPalette(overrides = {}) {
  const commands = overrides.commands || buildCommands();
  const onClose = overrides.onClose || vi.fn();
  render(<CommandPalette open commands={commands} onClose={onClose} />);
  return { commands, onClose };
}

describe("CommandPalette", () => {
  afterEach(() => cleanup());

  it("renders the search input with a placeholder", () => {
    renderPalette();
    const input = screen.getByLabelText(/search commands/i);
    expect(input).toBeTruthy();
    expect(input.getAttribute("placeholder")).toMatch(/type a command/i);
  });

  it("renders commands grouped by their group label", () => {
    renderPalette();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("View").length).toBeGreaterThan(0);
  });

  it("moves selection forward on ArrowDown", () => {
    renderPalette();
    const input = screen.getByLabelText(/search commands/i);
    // Initial selection is index 0 (Undo).
    expect(screen.getByRole("button", { name: /^Undo/i }).className).toMatch(/active/);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    expect(screen.getByRole("button", { name: /^Redo/i }).className).toMatch(/active/);
  });

  it("moves selection backward on ArrowUp", () => {
    renderPalette();
    const input = screen.getByLabelText(/search commands/i);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    expect(screen.getByRole("button", { name: /^Show Grid/i }).className).toMatch(/active/);
    fireEvent.keyDown(input, { key: "ArrowUp", code: "ArrowUp" });
    expect(screen.getByRole("button", { name: /^Redo/i }).className).toMatch(/active/);
  });

  it("activates the focused command on Enter", () => {
    const onClose = vi.fn();
    const { commands } = renderPalette({ onClose });
    const input = screen.getByLabelText(/search commands/i);
    fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(commands[1].run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    renderPalette({ onClose });
    const input = screen.getByLabelText(/search commands/i);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes the dark-mode command runner when activated (concern 2 wiring)", () => {
    // The parent decides what setTweak does; the palette only fires command.run.
    // This test guards that the canonical command list runner stays the contract.
    const setTweak = vi.fn();
    const commands = [
      { id: "cmd-dark", label: "Dark Mode", group: "View", run: () => setTweak("theme", "dark") },
    ];
    const onClose = vi.fn();
    render(<CommandPalette open commands={commands} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Dark Mode/i }));
    expect(setTweak).toHaveBeenCalledWith("theme", "dark");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders no items and shows an empty hint when filter has no matches", () => {
    renderPalette();
    const input = screen.getByLabelText(/search commands/i);
    fireEvent.change(input, { target: { value: "zzz-no-match" } });
    expect(screen.getByText(/no commands match/i)).toBeTruthy();
  });
});
