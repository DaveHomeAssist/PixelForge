import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const port = 4173;
const url = `http://127.0.0.1:${port}/PixelForge/`;
const screenshotDir = path.join(repoRoot, "artifacts", "smoke-visual");
const session = `pfvisual-${process.pid}`;
const marker = "PIXELFORGE_VISUAL_RESULT ";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: process.platform === "win32",
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, ...(options.env || {}) },
    });

    let stdout = "";
    let stderr = "";

    if (options.capture) {
      child.stdout.on("data", chunk => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      });
      child.stderr.on("data", chunk => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(text);
      });
    }

    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function runShell(command, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("/bin/zsh", ["-lc", command], {
      cwd: repoRoot,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, ...(options.env || {}) },
    });

    let stdout = "";
    let stderr = "";

    if (options.capture) {
      child.stdout.on("data", chunk => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      });
      child.stderr.on("data", chunk => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(text);
      });
    }

    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`shell command failed with exit code ${code}: ${command}`));
    });
  });
}

function startPreviewServer() {
  return spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: repoRoot,
    shell: process.platform === "win32",
    stdio: "inherit",
    env: process.env,
  });
}

async function waitForServer(maxAttempts = 100) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // retry
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function parseVisualResult(stdout) {
  const line = stdout.split(/\r?\n/).map(item => item.trim()).find(item => item.startsWith(marker));
  if (!line) return JSON.parse(stdout);
  return JSON.parse(line.slice(marker.length));
}

async function main() {
  await rm(screenshotDir, { recursive: true, force: true });
  await mkdir(screenshotDir, { recursive: true });

  console.log("[visual-smoke] Building project...");
  await run("npm", ["run", "build"]);

  const server = startPreviewServer();
  try {
    console.log(`[visual-smoke] Waiting for preview server at ${url} ...`);
    await waitForServer();

    const codePath = path.join(__dirname, "pixelforge-visual-smoke.run-code.js");
    console.log("[visual-smoke] Opening Playwright session...");
    await runShell(
      `export PATH=/opt/homebrew/Cellar/node@22/22.22.1_1/bin:$PATH; npx --yes --package @playwright/cli playwright-cli -s ${shellQuote(session)} open ${shellQuote(url)} >/tmp/pixelforge-visual-open.txt`,
    );
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("[visual-smoke] Executing visual run-code script...");
    const execution = await run(
      "npx",
      ["--yes", "--package", "@playwright/cli", "playwright-cli", "-s", session, "run-code", "--filename", codePath, "--raw"],
      {
        capture: true,
        env: {
          PIXELFORGE_SMOKE_URL: url,
          PIXELFORGE_VISUAL_SCREENSHOT_DIR: path.relative(repoRoot, screenshotDir),
        },
      },
    );

    const result = parseVisualResult(execution.stdout);
    const reportPath = path.join(screenshotDir, "report.json");
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

    console.log(`[visual-smoke] Report written to ${path.relative(repoRoot, reportPath)}`);

    if (result.failures.length > 0) {
      for (const failure of result.failures) {
        console.error(`[FAIL] ${failure.viewport} | ${failure.check} | ${failure.selector || "n/a"} | ${failure.message}`);
      }
      process.exitCode = 1;
      return;
    }

    for (const check of result.checks) {
      console.log(`[PASS] ${check.viewport} | ${check.check} | ${check.selector} | ${check.screenshotPath}`);
    }
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

main().catch(error => {
  console.error("[visual-smoke] Failed:", error.message);
  process.exitCode = 1;
});
