import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAutosaveRecovery from "../hooks/useAutosaveRecovery.js";
import { AUTOSAVE_KEY, AUTOSAVE_MAX_AGE_MS } from "../constants.js";
import { writeAutosave, readAutosave, deleteAutosave } from "../autosave.js";
import { buildDraftPayload } from "../serialization.js";

vi.mock("../autosave.js", () => ({
  writeAutosave: vi.fn(),
  readAutosave: vi.fn(),
  deleteAutosave: vi.fn(),
}));

vi.mock("../serialization.js", async () => {
  const actual = await vi.importActual("../serialization.js");
  return {
    ...actual,
    buildDraftPayload: vi.fn(),
  };
});

function makeProps(overrides = {}) {
  return {
    isDirty: false,
    docVersion: 1,
    docW: 1200,
    docH: 800,
    activeId: "layer-1",
    selectedShape: null,
    docRef: { current: { layers: {}, order: [] } },
    flash: vi.fn(),
    ...overrides,
  };
}

async function flushTimers(ms = 0) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useAutosaveRecovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    readAutosave.mockResolvedValue(undefined);
    writeAutosave.mockResolvedValue(undefined);
    deleteAutosave.mockResolvedValue(undefined);
    buildDraftPayload.mockResolvedValue({ layers: [{ id: "layer-1" }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("loads a valid stored recovery draft on mount", async () => {
    const storedDraft = {
      savedAt: Date.now(),
      project: { layers: [{ id: "layer-1" }] },
    };
    readAutosave.mockResolvedValue(storedDraft);

    const { result } = renderHook(() => useAutosaveRecovery(makeProps()));

    await flushMicrotasks();

    expect(result.current.recoveryDraft).toEqual(storedDraft);
    expect(readAutosave).toHaveBeenCalledWith(AUTOSAVE_KEY);
  });

  it("deletes stale drafts instead of recovering them", async () => {
    readAutosave.mockResolvedValue({
      savedAt: Date.now() - AUTOSAVE_MAX_AGE_MS - 1000,
      project: { layers: [{ id: "layer-1" }] },
    });

    const { result } = renderHook(() => useAutosaveRecovery(makeProps()));

    await flushMicrotasks();

    expect(deleteAutosave).toHaveBeenCalledWith(AUTOSAVE_KEY);
    expect(result.current.recoveryDraft).toBeNull();
  });

  it("writes autosave drafts after the debounce window when dirty", async () => {
    const props = makeProps({
      isDirty: true,
      docVersion: 4,
      selectedShape: { layerId: "vector-1", shapeId: "shape-1" },
    });

    renderHook(() => useAutosaveRecovery(props));

    await flushTimers(900);

    expect(buildDraftPayload).toHaveBeenCalledWith(
      props.docRef.current,
      1200,
      800,
      "layer-1",
      { layerId: "vector-1", shapeId: "shape-1" },
    );
    expect(writeAutosave).toHaveBeenCalledWith(
      AUTOSAVE_KEY,
      expect.objectContaining({
        savedAt: expect.any(Number),
        project: { layers: [{ id: "layer-1" }] },
      }),
    );
  });

  it("surfaces autosave failures through flash messaging", async () => {
    const flash = vi.fn();
    buildDraftPayload.mockRejectedValue(new Error("quota exceeded"));

    renderHook(() => useAutosaveRecovery(makeProps({ isDirty: true, flash })));

    await flushTimers(900);

    expect(flash).toHaveBeenCalledWith(
      "Autosave failed — draft may not be recoverable.",
      "error",
      3000,
    );
  });
});
