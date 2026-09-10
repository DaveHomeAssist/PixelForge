import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_SCHEMA_PATH,
  DEFAULT_STATE_PATH,
  loadSchema,
  validateOpsState,
  validateOpsStateFile,
} from "../../tools/ops/validate-ops-state.mjs";

describe("ops-state contract", () => {
  it("committed ops-state.json conforms to ops-state.schema.json", () => {
    expect(validateOpsStateFile(DEFAULT_STATE_PATH, DEFAULT_SCHEMA_PATH)).toEqual([]);
  });

  it("committed ops-state.json reports the generator that owns it", () => {
    const state = JSON.parse(readFileSync(DEFAULT_STATE_PATH, "utf8"));
    expect(state.metadata.generator).toBe("tools/ops/build-ops-state.mjs");
    expect(state.metadata.schemaVersion).toBe(2);
  });

  it("rejects documents that break the contract", () => {
    const schema = loadSchema();
    const valid = JSON.parse(readFileSync(DEFAULT_STATE_PATH, "utf8"));

    const badStatus = { ...valid, status: "green" };
    expect(validateOpsState(badStatus, schema)).toContainEqual(expect.stringContaining("$.status"));

    const missingMetadata = { ...valid };
    delete missingMetadata.metadata;
    expect(validateOpsState(missingMetadata, schema)).toContainEqual(expect.stringContaining('required property "metadata"'));

    const extraField = { ...valid, notes: "hand edited" };
    expect(validateOpsState(extraField, schema)).toContainEqual(expect.stringContaining('unexpected property "notes"'));

    const badKpi = { ...valid, kpis: [{ label: "", value: 1, status: "ok" }] };
    expect(validateOpsState(badKpi, schema)).toContainEqual(expect.stringContaining("$.kpis[0].label"));

    const badDate = { ...valid, updatedAt: "yesterday" };
    expect(validateOpsState(badDate, schema)).toContainEqual(expect.stringContaining("date-time"));
  });
});
