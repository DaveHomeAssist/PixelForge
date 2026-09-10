#!/usr/bin/env node
// PixelForge · Ops state validator
// Checks an ops-state document against ops-state.schema.json using only
// built-in modules (the ops tooling contract forbids third-party packages).
// Supports the subset of JSON Schema draft-07 the schema actually uses:
// type (single or union), required, properties, additionalProperties, enum,
// minLength, minimum, items, and format: date-time.
//
// Usage: node tools/ops/validate-ops-state.mjs [statePath] [schemaPath]

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

export const DEFAULT_STATE_PATH = join(ROOT, "ops-state.json");
export const DEFAULT_SCHEMA_PATH = join(ROOT, "ops-state.schema.json");

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === "number") return actual === "number" || actual === "integer";
  return actual === expected;
}

function validateNode(value, schema, path, errors) {
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some(type => matchesType(value, type))) {
      errors.push(`${path}: expected type ${allowed.join("|")}, got ${typeOf(value)}`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${path}: ${JSON.stringify(value)} is not a valid date-time`);
    }
  }

  if (typeof value === "number" && schema.minimum != null && value < schema.minimum) {
    errors.push(`${path}: ${value} is below minimum ${schema.minimum}`);
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => validateNode(item, schema.items, `${path}[${index}]`, errors));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path}: missing required property "${key}"`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key in properties) {
        validateNode(child, properties[key], `${path}.${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${key}"`);
      }
    }
  }
}

export function validateOpsState(state, schema) {
  const errors = [];
  validateNode(state, schema, "$", errors);
  return errors;
}

export function loadSchema(schemaPath = DEFAULT_SCHEMA_PATH) {
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

export function validateOpsStateFile(statePath = DEFAULT_STATE_PATH, schemaPath = DEFAULT_SCHEMA_PATH) {
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  return validateOpsState(state, loadSchema(schemaPath));
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const statePath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_STATE_PATH;
  const schemaPath = process.argv[3] ? resolve(process.argv[3]) : DEFAULT_SCHEMA_PATH;
  const errors = validateOpsStateFile(statePath, schemaPath);
  if (errors.length) {
    console.error(`[ops] ${statePath} violates ${schemaPath}:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`[ops] ${statePath} conforms to ${schemaPath}`);
}
