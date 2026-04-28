import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExportModal from "../components/ExportModal.jsx";

describe("ExportModal", () => {
  it("submits selected-region 2x PNG options", () => {
    const onExport = vi.fn();
    render(
      <ExportModal
        open
        initialOptions={{ format: "png", scale: 2, filename: "demo" }}
        selectionAvailable
        onClose={vi.fn()}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByLabelText(/Selected Region Only/i));
    fireEvent.click(screen.getAllByText("Export").at(-1));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({
      format: "png",
      scale: 2,
      selectedOnly: true,
      filename: "demo",
    }));
  });
});
