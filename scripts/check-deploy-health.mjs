// Post-deploy health check for the published site.
//
// Fetches the deployed page, confirms the app shell markup is present, then
// fetches the hashed module script and stylesheet the page references so a
// broken asset upload cannot pass. Retries to ride out Pages propagation.
//
// Usage: node scripts/check-deploy-health.mjs [baseUrl]
//   baseUrl defaults to PIXELFORGE_DEPLOY_URL or the live GitHub Pages origin.

import process from "node:process";

const baseUrl = normalizeBase(
  process.argv[2] || process.env.PIXELFORGE_DEPLOY_URL || "https://davehomeassist.github.io/PixelForge/",
);
const maxAttempts = Number(process.env.PIXELFORGE_HEALTH_ATTEMPTS || 10);
const retryDelayMs = Number(process.env.PIXELFORGE_HEALTH_RETRY_MS || 6000);

function normalizeBase(url) {
  return url.endsWith("/") ? url : `${url}/`;
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

function extractSameOriginAssets(html) {
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

async function checkOnce() {
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

  const assets = extractSameOriginAssets(page.body);
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
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await checkOnce();
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

main().catch(error => {
  console.error("[health] Failed:", error.message);
  process.exitCode = 1;
});
