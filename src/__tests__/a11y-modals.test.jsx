import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NewDocumentModal from "../components/NewDocumentModal.jsx";
import ResizeDocumentModal from "../components/ResizeDocumentModal.jsx";
import ExportModal from "../components/ExportModal.jsx";
import AdjustModal from "../components/AdjustModal.jsx";
import AIGenerateModal from "../components/AIGenerateModal.jsx";
import AISettingsModal from "../components/AISettingsModal.jsx";
import HistoryPanel from "../components/HistoryPanel.jsx";
import CommandPalette from "../components/CommandPalette.jsx";

// Mock the AI key helpers used by AIGenerateModal so we can mount the modal
// without crashing on missing localStorage.
vi.mock("../ai/storage.js", () => ({
  hasAnthropicKey: () => true,
  hasProviderKey: () => true,
  getApiConfig: () => ({ anthropicKey: "", providerId: "replicate", providerKey: "" }),
  setApiConfig: vi.fn(),
  clearApiConfig: vi.fn(),
}));

vi.mock("../ai/providers/index.js", () => ({
  listProviders: () => [{ id: "replicate", label: "Replicate" }],
  DEFAULT_PROVIDER_ID: "replicate",
}));

function makeOpener() {
  const opener = document.createElement("button");
  opener.textContent = "Outside opener";
  document.body.appendChild(opener);
  opener.focus();
  return opener;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a11y: modals expose dialog role + labelledby + close-on-Escape + return-focus", () => {
  it("NewDocumentModal: dialog/aria-modal/aria-labelledby; Escape closes; focus returns", () => {
    const opener = makeOpener();
    const closeModal = vi.fn();
    const { container, rerender, unmount } = render(
      <NewDocumentModal
        open
        docForm={{ width: 256, height: 256, background: "#ffffff" }}
        setDocForm={vi.fn()}
        recentDocPresets={[]}
        fieldFeedbackClass={() => ""}
        feedbackClass={() => ""}
        closeModal={closeModal}
        applyNewDocument={vi.fn()}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(closeModal).toHaveBeenCalledTimes(1);
    rerender(
      <NewDocumentModal
        open={false}
        docForm={{ width: 256, height: 256, background: "#ffffff" }}
        setDocForm={vi.fn()}
        recentDocPresets={[]}
        fieldFeedbackClass={() => ""}
        feedbackClass={() => ""}
        closeModal={closeModal}
        applyNewDocument={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(opener);
    unmount();
    opener.remove();
  });

  it("ResizeDocumentModal: dialog/aria-modal/aria-labelledby; Escape closes; focus returns", () => {
    const opener = makeOpener();
    const closeModal = vi.fn();
    const props = {
      resizeForm: { width: 256, height: 256, anchor: "center" },
      setResizeForm: vi.fn(),
      feedbackClass: () => "",
      closeModal,
      applyResizeCanvas: vi.fn(),
    };
    const { container, rerender, unmount } = render(<ResizeDocumentModal open {...props} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(closeModal).toHaveBeenCalledTimes(1);
    rerender(<ResizeDocumentModal open={false} {...props} />);
    expect(document.activeElement).toBe(opener);
    unmount();
    opener.remove();
  });

  it("ExportModal: dialog/aria-modal/aria-labelledby; Escape closes; focus returns", () => {
    const opener = makeOpener();
    const onClose = vi.fn();
    const { container, rerender, unmount } = render(
      <ExportModal
        open
        initialOptions={{ format: "png", scale: 1, filename: "f" }}
        selectionAvailable
        onClose={onClose}
        onExport={vi.fn()}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <ExportModal
        open={false}
        initialOptions={{ format: "png", scale: 1, filename: "f" }}
        selectionAvailable
        onClose={onClose}
        onExport={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(opener);
    unmount();
    opener.remove();
  });

  it("AdjustModal: dialog/aria-modal/aria-labelledby; Escape calls onCancel; focus returns", () => {
    const opener = makeOpener();
    const onCancel = vi.fn();
    const sourceImageData = new ImageData(2, 2);
    const { container, rerender, unmount } = render(
      <AdjustModal
        kind="brightness"
        open
        sourceImageData={sourceImageData}
        onCancel={onCancel}
        onCommit={vi.fn()}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    rerender(
      <AdjustModal
        kind="brightness"
        open={false}
        sourceImageData={sourceImageData}
        onCancel={onCancel}
        onCommit={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(opener);
    unmount();
    opener.remove();
  });

  it("AIGenerateModal: dialog/aria-modal/aria-labelledby; Escape closes; focus returns", () => {
    const opener = makeOpener();
    const onClose = vi.fn();
    const { container, unmount } = render(
      <AIGenerateModal onClose={onClose} onResult={vi.fn()} onOpenSettings={vi.fn()} />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("AISettingsModal: dialog/aria-modal/aria-labelledby; Escape closes; focus returns", () => {
    const opener = makeOpener();
    const onClose = vi.fn();
    const { container, unmount } = render(
      <AISettingsModal onClose={onClose} onSaved={vi.fn()} />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("HistoryPanel: dialog/aria-modal/aria-labelledby; Escape closes; focus returns", () => {
    const opener = makeOpener();
    const onClose = vi.fn();
    const { container, rerender, unmount } = render(
      <HistoryPanel open undoN={3} redoN={1} onUndo={vi.fn()} onRedo={vi.fn()} onClose={onClose} />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<HistoryPanel open={false} undoN={3} redoN={1} onUndo={vi.fn()} onRedo={vi.fn()} onClose={onClose} />);
    expect(document.activeElement).toBe(opener);
    unmount();
    opener.remove();
  });

  it("CommandPalette: dialog/aria-modal/aria-labelledby; Escape closes; focus returns", () => {
    const opener = makeOpener();
    const onClose = vi.fn();
    const commands = [{ id: "a", label: "Action A", run: vi.fn() }];
    const { container, rerender, unmount } = render(
      <CommandPalette open commands={commands} onClose={onClose} />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<CommandPalette open={false} commands={commands} onClose={onClose} />);
    expect(document.activeElement).toBe(opener);
    unmount();
    opener.remove();
  });
});

describe("a11y: Tab cycles inside modal", () => {
  beforeEach(() => {
    // Each test creates its own opener; nothing global needed.
  });

  it("ExportModal: Shift+Tab from first focusable wraps to last", () => {
    const { container, unmount } = render(
      <ExportModal
        open
        initialOptions={{ format: "png", scale: 1, filename: "f" }}
        selectionAvailable
        onClose={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    const focusables = Array.from(dialog.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'))
      .filter(n => !n.hasAttribute("disabled"));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    unmount();
  });

  it("HistoryPanel: Tab from last focusable wraps to first", () => {
    const { container, unmount } = render(
      <HistoryPanel open undoN={3} redoN={1} onUndo={vi.fn()} onRedo={vi.fn()} onClose={vi.fn()} />,
    );
    const dialog = container.querySelector('[role="dialog"]');
    const focusables = Array.from(dialog.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'))
      .filter(n => !n.hasAttribute("disabled"));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    unmount();
  });
});
