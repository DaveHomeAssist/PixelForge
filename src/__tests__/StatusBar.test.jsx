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

  it("shows the Tier 2 preview badge when a preview flag is active", () => {
    renderStatusBar({ tier2PreviewActive: true });

    expect(screen.getByText("Tier 2 (preview)")).toBeTruthy();
  });

  it("hides the Tier 2 preview badge when no preview flags are active", () => {
    renderStatusBar({ tier2PreviewActive: false });

    expect(screen.queryByText("Tier 2 (preview)")).toBeNull();
  });
});
