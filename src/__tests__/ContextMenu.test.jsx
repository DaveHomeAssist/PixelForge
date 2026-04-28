import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContextMenu from "../components/ContextMenu.jsx";

describe("ContextMenu", () => {
  it("renders, keyboard-navigates, invokes, and dismisses", () => {
    const first = vi.fn();
    const second = vi.fn();
    const onClose = vi.fn();
    render(<ContextMenu x={10} y={12} onClose={onClose} items={[
      { label: "First", onClick: first },
      { label: "Second", onClick: second },
    ]} />);

    const menu = screen.getByRole("menu");
    expect(screen.getByText("First")).toBeTruthy();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    fireEvent.keyDown(menu, { key: "Enter" });
    expect(second).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("dismisses on outside pointerdown", () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} onClose={onClose} items={[{ label: "A", onClick: vi.fn() }]} />);

    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
