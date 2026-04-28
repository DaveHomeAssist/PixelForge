#!/usr/bin/env node
// PixelForge · Ops state builder
// Writes PROJECT_ROOT/ops-state.json from a read-only inspection of the project.
// Contract: Node ESM, built-in modules only, does not mutate source files, does not parse issues.
// Ops Hub reads the output; this script never touches Ops Hub internals.

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const PROJECT = { id: "pixel-forge", name: "PixelForge" };
const SCHEMA_VERSION = 2;
const STALE_AFTER_MINUTES = 1440; // 24h

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..", "..");
const OUT = join(ROOT, "ops-state.json");

// ---- helpers ----
function safeRead(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}
function safeJson(path) {
  const raw = safeRead(path);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function safeStat(path) {
  try { return statSync(path); } catch { return null; }
}
function gitLastCommitIso() {
  try {
    const out = execFileSync("git", ["-C", ROOT, "log", "-1", "--format=%cI"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.toString().trim() || null;
  } catch { return null; }
}
function gitBranch() {
  try {
    const out = execFileSync("git", ["-C", ROOT, "rev-parse", "--abbrev-ref", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.toString().trim() || null;
  } catch { return null; }
}
function gitDirty() {
  try {
    const out = execFileSync("git", ["-C", ROOT, "status", "--porcelain"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.toString().trim().length > 0;
  } catch { return null; }
}
function minutesSince(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((Date.now() - t) / 60000);
}

// ---- collect signals ----
const pkg = safeJson(join(ROOT, "package.json")) || {};
const hasDist = existsSync(join(ROOT, "dist"));
const hasNodeModules = existsSync(join(ROOT, "node_modules"));
const hasReadme = existsSync(join(ROOT, "README.md"));
const hasClaudeMd = existsSync(join(ROOT, "CLAUDE.md"));
const hasEslint = existsSync(join(ROOT, "eslint.config.js")) || existsSync(join(ROOT, ".eslintrc")) || existsSync(join(ROOT, ".eslintrc.js"));
const hasVitest = existsSync(join(ROOT, "vitest.config.js")) || existsSync(join(ROOT, "vitest.config.ts"));
const hasUiIssues = existsSync(join(ROOT, "docs", "UI_ISSUES_TABLE.html"));

const lastCommitIso = gitLastCommitIso();
const branch = gitBranch();
const dirty = gitDirty();
const ageMin = minutesSince(lastCommitIso);

// ---- freshness ----
let freshness = "unknown";
if (lastCommitIso && ageMin != null) {
  freshness = ageMin <= STALE_AFTER_MINUTES ? "fresh" : "stale";
} else if (!existsSync(join(ROOT, ".git"))) {
  freshness = "missing";
}

// ---- kpis ----
const kpis = [];
kpis.push({
  label: "Version",
  value: pkg.version || "unknown",
  status: pkg.version ? "ok" : "unknown",
});
kpis.push({
  label: "Branch",
  value: branch || "unknown",
  status: branch === "main" ? "ok" : (branch ? "warn" : "unknown"),
});
kpis.push({
  label: "Working tree",
  value: dirty == null ? "unknown" : (dirty ? "dirty" : "clean"),
  status: dirty == null ? "unknown" : (dirty ? "warn" : "ok"),
});
kpis.push({
  label: "Dist built",
  value: hasDist ? "yes" : "no",
  status: hasDist ? "ok" : "warn",
});
kpis.push({
  label: "Deps installed",
  value: hasNodeModules ? "yes" : "no",
  status: hasNodeModules ? "ok" : "warn",
});
kpis.push({
  label: "Lint config",
  value: hasEslint ? "present" : "absent",
  status: hasEslint ? "ok" : "warn",
});
kpis.push({
  label: "Test runner",
  value: hasVitest ? "vitest" : "none",
  status: hasVitest ? "ok" : "warn",
});

// ---- issues (surface-level only: presence signals, no parsing) ----
const issues = [];
if (hasUiIssues) {
  issues.push({
    id: "ui-issues-table",
    severity: "P2",
    status: "open",
    title: "docs/UI_ISSUES_TABLE.html present — review outside dashboard",
    source: "docs/UI_ISSUES_TABLE.html",
  });
}
if (dirty === true) {
  issues.push({
    id: "git-dirty",
    severity: "P3",
    status: "open",
    title: "Working tree has uncommitted changes",
    source: ".git",
  });
}

// ---- overall status rollup ----
function rollup(kpisArr, issuesArr) {
  const anyErr = kpisArr.some(k => k.status === "err") || issuesArr.some(i => i.severity === "P0" || i.severity === "P1");
  if (anyErr) return "err";
  const anyWarn = kpisArr.some(k => k.status === "warn") || issuesArr.some(i => i.severity === "P2");
  if (anyWarn) return "warn";
  const anyUnknown = kpisArr.some(k => k.status === "unknown");
  if (anyUnknown) return "unknown";
  return "ok";
}
const status = rollup(kpis, issues);

// ---- recommendations ----
const recommendations = [];
function recommend(priority, title, reason, command = null) {
  recommendations.push({ priority, title, reason, command });
}
if (freshness === "stale") {
  recommend("P2", "Refresh project activity", "Latest commit activity is outside the freshness window.");
}
if (dirty === true) {
  recommend("P2", "Resolve working tree drift", "Uncommitted changes make dashboard status harder to trust.", "git status --short");
}
if (!hasDist) {
  recommend("P2", "Create a build artifact", "No dist directory was found, so shipped output is unclear.");
}
if (!hasNodeModules) {
  recommend("P2", "Install dependencies", "node_modules is missing, so local validation may not run.", "npm install");
}
if (!hasVitest) {
  recommend("P3", "Add a test runner", "No Vitest config was found.");
}
if (hasUiIssues) {
  recommend("P2", "Review UI issue tracker", "docs/UI_ISSUES_TABLE.html is present and should be reviewed outside this dashboard.");
}
if (branch && branch !== "main") {
  recommend("P3", "Review branch state", `Current branch is ${branch}, not main.`);
}

// ---- grouped sections ----
const sections = [
  {
    title: "Build",
    items: kpis.filter((item) => ["Version", "Dist built", "Deps installed"].includes(item.label)),
  },
  {
    title: "Git",
    items: kpis.filter((item) => ["Branch", "Working tree"].includes(item.label)),
  },
  {
    title: "Quality",
    items: kpis.filter((item) => ["Lint config", "Test runner"].includes(item.label)),
  },
];

// ---- summary ----
const summaryBits = [];
summaryBits.push(pkg.version ? `v${pkg.version}` : "no version");
if (branch) summaryBits.push(`branch ${branch}`);
if (dirty != null) summaryBits.push(dirty ? "dirty tree" : "clean tree");
if (issues.length) summaryBits.push(`${issues.length} open issue${issues.length === 1 ? "" : "s"}`);
const summary = summaryBits.join(" · ");

// ---- links ----
const links = [];
if (hasReadme) links.push({ label: "README", path: "README.md" });
if (hasClaudeMd) links.push({ label: "CLAUDE.md", path: "CLAUDE.md" });
if (existsSync(join(ROOT, "package.json"))) links.push({ label: "package.json", path: "package.json" });
if (hasUiIssues) links.push({ label: "UI issues table", path: "docs/UI_ISSUES_TABLE.html" });
if (existsSync(join(ROOT, "dist", "index.html"))) links.push({ label: "Built index", path: "dist/index.html" });

// ---- assemble ----
const state = {
  project: { id: PROJECT.id, name: PROJECT.name },
  status,
  freshness,
  updatedAt: new Date().toISOString(),
  summary,
  recommendations,
  sections,
  kpis,
  issues,
  links,
  metadata: {
    generator: "tools/ops/build-ops-state.mjs",
    schemaVersion: SCHEMA_VERSION,
    root: relative(process.cwd(), ROOT) || ".",
    lastCommitAt: lastCommitIso,
    lastCommitAgeMinutes: ageMin,
    staleAfterMinutes: STALE_AFTER_MINUTES,
  },
};

// ---- write ----
try {
  writeFileSync(OUT, JSON.stringify(state, null, 2) + "\n", "utf8");
} catch (err) {
  console.error("[ops] write failed:", err && err.message ? err.message : err);
  process.exit(2);
}

console.log(`[ops] wrote ${OUT}`);
console.log(`[ops] status=${status} freshness=${freshness} kpis=${kpis.length} issues=${issues.length}`);
