import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StatusBar from "../components/StatusBar.jsx";

function renderStatusBar(overrides = {}) {
  return render(
    <StatusBar
      docW={512}
      docH={512}
      zoom={1}
      activeLayer={{ name: "Layer 1", type: "raster" }}
      toolMeta={{ label: "Brush" }}
      isDirty={false}
      lastSavedAt={null}
      clipboardStatus={null}
      {...overrides}
    />,
  );
}

describe("StatusBar", () => {
  afterEach(() => cleanup());

  it("uppercases the active tool label inside the live pill", () => {
    renderStatusBar({ toolMeta: { label: "Brush" } });
    expect(screen.getByText("BRUSH")).toBeTruthy();
  });

  it("displays document dimensions and the zoom percentage", () => {
    renderStatusBar({ docW: 1024, docH: 768, zoom: 1.5 });
    expect(screen.getByText(/1024 × 768/)).toBeTruthy();
    expect(screen.getByText("150%")).toBeTruthy();
  });

  it("shows the clipboard status pill with aria-live polite when set", () => {
    renderStatusBar({ clipboardStatus: "Copied" });
    const pill = screen.getByRole("status");
    expect(pill.textContent).toBe("Copied");
    expect(pill.getAttribute("aria-live")).toBe("polite");
  });

  it("renders the active layer name and kind", () => {
    renderStatusBar({ activeLayer: { name: "Background", type: "raster" } });
    expect(screen.getByText(/Background.*raster/i)).toBeTruthy();
  });

  it("shows the Tier 2 preview badge when a preview flag is active", () => {
    renderStatusBar({ tier2PreviewActive: true });
    expect(screen.getByText("Tier 2 (preview)")).toBeTruthy();
  });

  it("hides the Tier 2 preview badge when no preview flags are active", () => {
    renderStatusBar({ tier2PreviewActive: false });
    expect(screen.queryByText("Tier 2 (preview)")).toBeNull();
  });
});
