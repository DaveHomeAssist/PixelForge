import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import useDocumentController from "../hooks/useDocumentController.js";
import {
  createDefaultDocument, buildProjectPayload, hydrateDraftPayload,
} from "../serialization.js";
import { saveProjectPayload, supportsFileSave } from "../projectFiles.js";
import { createRasterLayerFromImage } from "../imageImport.js";

vi.mock("../serialization.js", () => ({
  createDefaultDocument: vi.fn(),
  buildProjectPayload: vi.fn(),
  hydrateProject: vi.fn(),
  hydrateDraftPayload: vi.fn(),
}));

vi.mock("../projectFiles.js", () => ({
  saveProjectPayload: vi.fn(),
  supportsFileSave: vi.fn(),
}));

vi.mock("../imageImport.js", () => ({
  createRasterLayerFromImage: vi.fn(),
}));

function makeArgs(overrides = {}) {
  return {
    docRef: { current: { layers: {}, order: [] } },
    renderCacheRef: { current: {} },
    fileRef: { current: { click: vi.fn() } },
    importRef: { current: { click: vi.fn() } },
    docState: {
      docW: 1200,
      docH: 800,
      activeId: "layer-1",
      selectedShape: null,
      saveHandle: null,
      isDirty: false,
      isCompactUI: false,
      docForm: { width: 1200, height: 800, background: "#ffffff" },
      resizeForm: { width: 1200, height: 800, anchor: "center" },
      recoveryDraft: null,
      preferredRasterTool: "brush",
      ...(overrides.docState || {}),
    },
    prefs: {
      docPrefs: {
        lastNewDoc: { width: 1200, height: 800, background: "#ffffff" },
        lastResizeAnchor: "center",
      },
      ...(overrides.prefs || {}),
    },
    stateSetters: {
      setDocW: vi.fn(),
      setDocH: vi.fn(),
      setActiveId: vi.fn(),
      setSelectedShape: vi.fn(),
      setResizeForm: vi.fn(),
      setTool: vi.fn(),
      setBrushSize: vi.fn(),
      setBrushOpacity: vi.fn(),
      setFillOn: vi.fn(),
      setStrokeOn: vi.fn(),
      setStrokeW: vi.fn(),
      setColor1: vi.fn(),
      setColor2: vi.fn(),
      setStarterDismissed: vi.fn(),
      setIsDirty: vi.fn(),
      setLastSavedAt: vi.fn(),
      setSaveHandle: vi.fn(),
      setModal: vi.fn(),
      setMobilePanelTab: vi.fn(),
      setDocForm: vi.fn(),
      ...(overrides.stateSetters || {}),
    },
    historyApi: {
      clearHistory: vi.fn(),
      syncEditor: vi.fn(),
      withFullHistory: vi.fn((mutate) => mutate()),
      ...(overrides.historyApi || {}),
    },
    viewportApi: {
      fitViewTo: vi.fn(),
      ...(overrides.viewportApi || {}),
    },
    feedbackApi: {
      flash: vi.fn(),
      triggerFeedback: vi.fn(),
      triggerFieldFeedback: vi.fn(),
      ...(overrides.feedbackApi || {}),
    },
    prefsApi: {
      updatePrefs: vi.fn(),
      ...(overrides.prefsApi || {}),
    },
    recoveryApi: {
      clearRecoveryDraft: vi.fn(),
      ...(overrides.recoveryApi || {}),
    },
  };
}

describe("useDocumentController", () => {
  const originalRaf = globalThis.requestAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1712750400000);
    globalThis.requestAnimationFrame = vi.fn((callback) => {
      callback();
      return 1;
    });
    supportsFileSave.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.requestAnimationFrame = originalRaf;
  });

  it("saves to a file handle and marks the project clean", async () => {
    const args = makeArgs();
    buildProjectPayload.mockReturnValue({ v: 2 });
    saveProjectPayload.mockResolvedValue({ mode: "file", handle: { kind: "file" } });

    const { result } = renderHook(() => useDocumentController(args));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(buildProjectPayload).toHaveBeenCalledWith(
      args.docRef.current,
      1200,
      800,
      "layer-1",
      null,
    );
    expect(saveProjectPayload).toHaveBeenCalledWith({ v: 2 }, null);
    expect(args.stateSetters.setSaveHandle).toHaveBeenCalledWith({ kind: "file" });
    expect(args.stateSetters.setIsDirty).toHaveBeenCalledWith(false);
    expect(args.stateSetters.setLastSavedAt).toHaveBeenCalledWith(1712750400000);
    expect(args.recoveryApi.clearRecoveryDraft).toHaveBeenCalled();
    expect(args.feedbackApi.triggerFeedback).toHaveBeenCalledWith("save", "success");
    expect(args.feedbackApi.flash).toHaveBeenCalledWith("Project saved", "success");
  });

  it("rejects invalid new document background colors before mutating state", () => {
    const args = makeArgs({
      docState: {
        docForm: { width: 900, height: 700, background: "not-a-color" },
      },
    });

    const { result } = renderHook(() => useDocumentController(args));

    act(() => {
      result.current.applyNewDocument();
    });

    expect(args.feedbackApi.triggerFieldFeedback).toHaveBeenCalledWith("doc-background", "error");
    expect(args.feedbackApi.triggerFeedback).toHaveBeenCalledWith("new-doc", "error");
    expect(args.feedbackApi.flash).toHaveBeenCalledWith("Use a valid background hex color.", "error");
    expect(createDefaultDocument).not.toHaveBeenCalled();
    expect(args.historyApi.withFullHistory).not.toHaveBeenCalled();
  });

  it("hydrates a recovered draft into editor state and clears the recovery prompt", async () => {
    const project = {
      doc: { layers: { "layer-9": { id: "layer-9", type: "raster" } }, order: ["layer-9"] },
      docW: 640,
      docH: 480,
      activeId: "layer-9",
      selectedShape: null,
    };
    const args = makeArgs({
      docState: {
        recoveryDraft: {
          savedAt: 1712740000000,
          project: { layers: [{ id: "layer-9" }] },
        },
      },
    });
    hydrateDraftPayload.mockResolvedValue(project);

    const { result } = renderHook(() => useDocumentController(args));

    await act(async () => {
      result.current.recoverDraftProject();
      await Promise.resolve();
    });

    expect(hydrateDraftPayload).toHaveBeenCalledWith({ layers: [{ id: "layer-9" }] });
    expect(args.historyApi.clearHistory).toHaveBeenCalled();
    expect(args.stateSetters.setDocW).toHaveBeenCalledWith(640);
    expect(args.stateSetters.setDocH).toHaveBeenCalledWith(480);
    expect(args.stateSetters.setActiveId).toHaveBeenCalledWith("layer-9");
    expect(args.stateSetters.setSelectedShape).toHaveBeenCalledWith(null);
    expect(args.stateSetters.setIsDirty).toHaveBeenCalledWith(true);
    expect(args.stateSetters.setLastSavedAt).toHaveBeenCalledWith(1712740000000);
    expect(args.recoveryApi.clearRecoveryDraft).toHaveBeenCalled();
    expect(args.viewportApi.fitViewTo).toHaveBeenCalledWith(640, 480);
    expect(args.feedbackApi.triggerFeedback).toHaveBeenCalledWith("recover", "success");
    expect(args.feedbackApi.flash).toHaveBeenCalledWith("Recovered autosaved draft", "success");
  });

  it("handleViewportDrop imports each image file sequentially", async () => {
    const args = makeArgs();
    createRasterLayerFromImage.mockResolvedValue("new-layer-id");
    const file1 = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    const file2 = new File([new Uint8Array([2])], "b.jpg", { type: "image/jpeg" });

    const { result } = renderHook(() => useDocumentController(args));

    await act(async () => {
      await result.current.handleViewportDrop([file1, file2]);
    });

    expect(createRasterLayerFromImage).toHaveBeenCalledTimes(2);
    expect(createRasterLayerFromImage).toHaveBeenNthCalledWith(1, file1, expect.objectContaining({ name: "a" }));
    expect(createRasterLayerFromImage).toHaveBeenNthCalledWith(2, file2, expect.objectContaining({ name: "b" }));
  });

  it("handleViewportDrop filters non-image files and flashes an error when nothing is importable", async () => {
    const args = makeArgs();
    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });

    const { result } = renderHook(() => useDocumentController(args));

    await act(async () => {
      await result.current.handleViewportDrop([textFile]);
    });

    expect(createRasterLayerFromImage).not.toHaveBeenCalled();
    expect(args.feedbackApi.flash).toHaveBeenCalledWith("Drop an image file", "error");
  });

  it("handleViewportDrop with zero files is a no-op", async () => {
    const args = makeArgs();
    const { result } = renderHook(() => useDocumentController(args));

    await act(async () => {
      await result.current.handleViewportDrop([]);
    });

    expect(createRasterLayerFromImage).not.toHaveBeenCalled();
    expect(args.feedbackApi.flash).not.toHaveBeenCalledWith("Drop an image file", "error");
  });

  it("handleClipboardPaste labels the layer 'Pasted Image'", async () => {
    const args = makeArgs();
    createRasterLayerFromImage.mockResolvedValue("paste-id");
    const file = new File([new Uint8Array([1])], "clipboard.png", { type: "image/png" });

    const { result } = renderHook(() => useDocumentController(args));

    await act(async () => {
      await result.current.handleClipboardPaste(file);
    });

    expect(createRasterLayerFromImage).toHaveBeenCalledWith(file, expect.objectContaining({ name: "Pasted Image" }));
  });
});
