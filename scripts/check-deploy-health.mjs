// Post-deploy health check for the published site.
//
// Fetches the deployed page, confirms the app shell markup is present, then
// fetches the hashed module script and stylesheet the page references so a
// broken asset upload cannot pass. When an expected build stamp is supplied
// (PIXELFORGE_EXPECTED_BUILD or --expect-build), the page must carry that
// stamp in its <meta name="pixelforge-build"> tag, so a stale or partial
// deployment cannot pass just because some earlier build is still served.
// Retries to ride out Pages propagation.
//
// Usage: node scripts/check-deploy-health.mjs [baseUrl] [--expect-build <sha>]
//   baseUrl defaults to PIXELFORGE_DEPLOY_URL or the live GitHub Pages origin.

import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const BUILD_META_NAME = "pixelforge-build";

export function normalizeBase(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

export function parseArgs(argv) {
  const positional = [];
  let expectedBuild = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--expect-build") {
      expectedBuild = argv[index + 1] || null;
      index += 1;
    } else {
      positional.push(arg);
    }
  }
  return { baseUrl: positional[0] || null, expectedBuild };
}

async function fetchOk(url, accept) {
  const response = await fetch(url, { redirect: "follow", headers: { accept } });
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}`);
  }
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`GET ${url} returned an empty body`);
  }
  return { body, contentType: response.headers.get("content-type") || "" };
}

export function extractSameOriginAssets(html, baseUrl) {
  const assets = [];
  const patterns = [
    { kind: "script", regex: /<script[^>]*type="module"[^>]*src="([^"]+)"/g },
    { kind: "stylesheet", regex: /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g },
  ];
  for (const { kind, regex } of patterns) {
    for (const match of html.matchAll(regex)) {
      const resolved = new URL(match[1], baseUrl);
      if (resolved.origin === new URL(baseUrl).origin) {
        assets.push({ kind, url: resolved.href });
      }
    }
  }
  return assets;
}

export function extractBuildStamp(html) {
  const match = html.match(/<meta\s+name="pixelforge-build"\s+content="([^"]*)"/i)
    || html.match(/<meta\s+content="([^"]*)"\s+name="pixelforge-build"/i);
  return match ? match[1] : null;
}

export async function checkOnce({ baseUrl, expectedBuild }) {
  const page = await fetchOk(baseUrl, "text/html");
  if (!page.contentType.includes("text/html")) {
    throw new Error(`Expected text/html from ${baseUrl}, got ${page.contentType}`);
  }
  if (!page.body.includes('<div id="root">')) {
    throw new Error(`App root markup missing from ${baseUrl}`);
  }
  if (!page.body.includes("PixelForge")) {
    throw new Error(`Expected PixelForge branding in ${baseUrl}`);
  }
  console.log(`[health] PASS page | ${baseUrl}`);

  const stamp = extractBuildStamp(page.body);
  if (expectedBuild) {
    if (!stamp) {
      throw new Error(`Page at ${baseUrl} carries no ${BUILD_META_NAME} stamp; expected ${expectedBuild}`);
    }
    if (stamp !== expectedBuild) {
      throw new Error(`Page at ${baseUrl} is build ${stamp}, expected ${expectedBuild}`);
    }
    console.log(`[health] PASS build | ${stamp}`);
  } else {
    console.log(`[health] INFO build | ${stamp || "unstamped"} (no expected build supplied, not enforced)`);
  }

  const assets = extractSameOriginAssets(page.body, baseUrl);
  const hasScript = assets.some(asset => asset.kind === "script");
  const hasStylesheet = assets.some(asset => asset.kind === "stylesheet");
  if (!hasScript || !hasStylesheet) {
    throw new Error(
      `Page must reference a same-origin module script and stylesheet (found ${assets.length} assets)`,
    );
  }

  for (const asset of assets) {
    const expected = asset.kind === "script" ? "javascript" : "css";
    const { contentType } = await fetchOk(asset.url, "*/*");
    if (!contentType.includes(expected)) {
      throw new Error(`Expected ${expected} content type from ${asset.url}, got ${contentType}`);
    }
    console.log(`[health] PASS ${asset.kind} | ${asset.url}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBase(
    args.baseUrl || process.env.PIXELFORGE_DEPLOY_URL || "https://davehomeassist.github.io/PixelForge/",
  );
  const expectedBuild = (args.expectedBuild || process.env.PIXELFORGE_EXPECTED_BUILD || "").trim() || null;
  const maxAttempts = Number(process.env.PIXELFORGE_HEALTH_ATTEMPTS || 10);
  const retryDelayMs = Number(process.env.PIXELFORGE_HEALTH_RETRY_MS || 6000);

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await checkOnce({ baseUrl, expectedBuild });
      console.log(`[health] Deployment healthy at ${baseUrl}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[health] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  throw lastError;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch(error => {
    console.error("[health] Failed:", error.message);
    process.exitCode = 1;
  });
}
