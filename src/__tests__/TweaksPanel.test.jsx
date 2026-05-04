import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TweaksPanel from "../components/TweaksPanel.jsx";
import { TWEAK_DEFAULTS } from "../hooks/useTweaks.js";

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    tweaks: { ...TWEAK_DEFAULTS },
    setTweak: vi.fn(),
    resetTweaks: vi.fn(),
    ...overrides,
  };
  const utils = render(<TweaksPanel {...props} />);
  return { ...utils, props };
}

describe("TweaksPanel", () => {
  it("does not render when open is false", () => {
    const { container } = renderPanel({ open: false });
    expect(container.childElementCount).toBe(0);
  });

  it("renders the four tweak sections when open", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: /^Theme$/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Typography$/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Layout$/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Density and shape/ })).toBeTruthy();
  });

  it("renders the dialog with an accessible name", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog", { name: /Tweaks/ });
    expect(dialog).toBeTruthy();
  });

  it("close button calls onClose", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    await user.click(screen.getByRole("button", { name: /Close tweaks/ }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click calls onClose", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByTestId("pf-tweaks-backdrop"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key calls onClose", () => {
    const { props } = renderPanel();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("theme radio fires setTweak with the chosen mode", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    const lightRadio = screen.getByRole("radio", { name: "Light" });
    await user.click(lightRadio);
    expect(props.setTweak).toHaveBeenCalledWith("theme", "light");
  });

  it("accent select fires setTweak with the chosen accent", () => {
    const { props } = renderPanel();
    const accentSelect = screen.getByLabelText("Accent");
    fireEvent.change(accentSelect, { target: { value: "coral" } });
    expect(props.setTweak).toHaveBeenCalledWith("accent", "coral");
  });

  it("density slider fires setTweak with a numeric density", () => {
    const { props } = renderPanel();
    const densitySlider = screen.getByLabelText("Density");
    fireEvent.change(densitySlider, { target: { value: "1.1" } });
    expect(props.setTweak).toHaveBeenCalledWith("density", 1.1);
  });

  it("radius slider fires setTweak with a numeric radius", () => {
    const { props } = renderPanel();
    const radiusSlider = screen.getByLabelText("Radius");
    fireEvent.change(radiusSlider, { target: { value: "12" } });
    expect(props.setTweak).toHaveBeenCalledWith("radius", 12);
  });

  it("Reset to defaults button calls resetTweaks", async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    await user.click(screen.getByRole("button", { name: /Reset to defaults/ }));
    expect(props.resetTweaks).toHaveBeenCalledTimes(1);
  });
});
