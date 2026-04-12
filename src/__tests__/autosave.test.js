import { describe, it, expect, beforeEach } from "vitest";
import { writeAutosave, readAutosave, deleteAutosave } from "../autosave.js";

const TEST_KEY = "__test_autosave__";

beforeEach(async () => {
  await deleteAutosave(TEST_KEY).catch(() => {});
});

describe("IndexedDB autosave", () => {
  it("writes and reads back data", async () => {
    const data = { savedAt: Date.now(), project: { layers: [{ id: "l1" }] } };
    await writeAutosave(TEST_KEY, data);
    const result = await readAutosave(TEST_KEY);
    expect(result).toEqual(data);
  });

  it("returns undefined for missing key", async () => {
    const result = await readAutosave("__nonexistent__");
    expect(result).toBeUndefined();
  });

  it("deletes stored data", async () => {
    await writeAutosave(TEST_KEY, { x: 1 });
    await deleteAutosave(TEST_KEY);
    const result = await readAutosave(TEST_KEY);
    expect(result).toBeUndefined();
  });

  it("overwrites existing data", async () => {
    await writeAutosave(TEST_KEY, { v: 1 });
    await writeAutosave(TEST_KEY, { v: 2 });
    const result = await readAutosave(TEST_KEY);
    expect(result).toEqual({ v: 2 });
  });
});
