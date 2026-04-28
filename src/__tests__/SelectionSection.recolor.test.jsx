import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SelectionSection from "../components/SelectionSection.jsx";

describe("SelectionSection recolor controls", () => {
  it("updates fill and commits once on blur", () => {
    const begin = vi.fn();
    const input = vi.fn();
    const commit = vi.fn();
    render(
      <SelectionSection
        selectedShapeType="rect"
        selectedShapeFields={{ x: "1", y: "2", w: "3", h: "4", fill: "#112233", fillOn: true, stroke: "#445566", strokeOn: true, strokeWidth: "2" }}
        beginSelectionFieldEdit={begin}
        handleSelectionFieldInput={input}
        commitSelectionFieldEdits={commit}
        duplicateSelectedShape={vi.fn()}
        deleteSelectedShape={vi.fn()}
        feedbackClass={() => ""}
      />,
    );

    const fill = screen.getByLabelText("Fill color");
    fireEvent.focus(fill);
    fireEvent.change(fill, { target: { value: "#abcdef" } });
    fireEvent.blur(fill);

    expect(begin).toHaveBeenCalled();
    expect(input).toHaveBeenCalledWith("fill", "#abcdef");
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
