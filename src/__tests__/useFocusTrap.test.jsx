import { useRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useFocusTrap from "../hooks/useFocusTrap.js";

function Harness({ active = true, onEscape, restore = true, autoFocus = true, includeDisabled = false, includeHidden = false }) {
  const containerRef = useRef(null);
  useFocusTrap(active, containerRef, { restore, autoFocus, onEscape });
  return (
    <div ref={containerRef} data-testid="trap-container">
      <button data-testid="first">First</button>
      {includeDisabled && <button data-testid="disabled-btn" disabled>Disabled</button>}
      {includeHidden && <button data-testid="hidden-btn" hidden>Hidden</button>}
      <input data-testid="middle" />
      <button data-testid="last">Last</button>
    </div>
  );
}

function ControlledHarness({ active, onEscape }) {
  const containerRef = useRef(null);
  useFocusTrap(active, containerRef, { restore: true, autoFocus: true, onEscape });
  if (!active) return null;
  return (
    <div ref={containerRef} data-testid="trap-container">
      <button data-testid="first">First</button>
      <input data-testid="middle" />
      <button data-testid="last">Last</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves focus to the first focusable when active", () => {
    const { getByTestId } = render(<Harness />);
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("wraps focus from last back to first on Tab", () => {
    const { getByTestId } = render(<Harness />);
    const last = getByTestId("last");
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(getByTestId("trap-container"), { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("wraps focus from first back to last on Shift+Tab", () => {
    const { getByTestId } = render(<Harness />);
    const first = getByTestId("first");
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(getByTestId("trap-container"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(getByTestId("last"));
  });

  it("calls onEscape when Escape is pressed inside the container", () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<Harness onEscape={onEscape} />);
    fireEvent.keyDown(getByTestId("trap-container"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the previously focused element when active flips false", () => {
    // Pre-mount opener element so it can capture focus prior to the trap.
    const opener = document.createElement("button");
    opener.textContent = "Outside opener";
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(<ControlledHarness active />);
    // Trap is active and pulled focus inside the container.
    expect(document.activeElement).not.toBe(opener);

    rerender(<ControlledHarness active={false} />);
    // After flipping the trap off, focus returns to the previously focused element.
    expect(document.activeElement).toBe(opener);

    opener.remove();
  });

  it("skips disabled focusables when computing the focus list", () => {
    const { getByTestId } = render(<Harness includeDisabled />);
    // First focusable is still 'first'; disabled button is skipped.
    expect(document.activeElement).toBe(getByTestId("first"));
    // Tab from last should wrap to first, skipping disabled.
    getByTestId("last").focus();
    fireEvent.keyDown(getByTestId("trap-container"), { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("skips hidden focusables when computing the focus list", () => {
    const { getByTestId } = render(<Harness includeHidden />);
    expect(document.activeElement).toBe(getByTestId("first"));
    getByTestId("last").focus();
    fireEvent.keyDown(getByTestId("trap-container"), { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("does not auto-focus when autoFocus is false", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    render(<Harness autoFocus={false} />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("is a no-op when active is false", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    render(<Harness active={false} />);
    // Active was false from the start so no autofocus and no listener wired.
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
