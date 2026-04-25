import { afterEach, describe, expect, it, vi } from "vitest";
import { saveProjectPayload, supportsFileSave } from "../projectFiles.js";

describe("projectFiles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    try {
      delete window.showSaveFilePicker;
    } catch (error) {
      void error;
    }
  });

  it("supportsFileSave only when showSaveFilePicker is a function", () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      writable: true,
      value: () => {},
    });
    expect(supportsFileSave()).toBe(true);

    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      writable: true,
      value: "not-a-function",
    });
    expect(supportsFileSave()).toBe(false);
  });

  it("writes via file handle when File System Access is available", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const write = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const handle = { createWritable };
    const showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      writable: true,
      value: showSaveFilePicker,
    });

    const payload = { v: 3, doc: { order: [] } };
    const result = await saveProjectPayload(payload, null, "manual.pforge");

    expect(result).toEqual({ mode: "file", handle });
    expect(showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(createWritable).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(JSON.stringify(payload));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("falls back to browser download when File System Access is unavailable", async () => {
    Object.defineProperty(window, "showSaveFilePicker", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const click = vi.fn();
    const anchor = { click };
    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const payload = { v: 3, doc: { order: [] } };
    const result = await saveProjectPayload(payload, null, "fallback.pforge");

    expect(result).toEqual({ mode: "download", handle: null });
    expect(anchor.download).toBe("fallback.pforge");
    expect(anchor.href).toBe("blob:mock-url");
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
