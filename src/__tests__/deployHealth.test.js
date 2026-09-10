import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import {
  checkOnce,
  extractBuildStamp,
  extractSameOriginAssets,
  parseArgs,
} from "../../scripts/check-deploy-health.mjs";

const PAGE = (stamp) => `<!doctype html><html><head>
<meta name="pixelforge-build" content="${stamp}">
<title>PixelForge</title>
<script type="module" crossorigin src="/PixelForge/assets/index-abc.js"></script>
<link rel="stylesheet" crossorigin href="/PixelForge/assets/index-abc.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
</head><body><div id="root"></div></body></html>`;

function serve(routes) {
  const server = createServer((req, res) => {
    const route = routes[req.url];
    if (!route) {
      res.statusCode = 404;
      res.end("missing");
      return;
    }
    res.setHeader("content-type", route.type);
    res.end(route.body);
  });
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/PixelForge/` });
    });
  });
}

describe("check-deploy-health parsing", () => {
  it("parses positional base url and expected build flag", () => {
    expect(parseArgs(["https://example.test/PixelForge/", "--expect-build", "abc123"])).toEqual({
      baseUrl: "https://example.test/PixelForge/",
      expectedBuild: "abc123",
    });
    expect(parseArgs([])).toEqual({ baseUrl: null, expectedBuild: null });
  });

  it("extracts the build stamp and only same-origin assets", () => {
    const html = PAGE("deadbeef");
    expect(extractBuildStamp(html)).toBe("deadbeef");
    expect(extractBuildStamp("<html><head></head></html>")).toBeNull();
    const assets = extractSameOriginAssets(html, "https://example.test/PixelForge/");
    expect(assets.map(asset => asset.kind)).toEqual(["script", "stylesheet"]);
    expect(assets.every(asset => asset.url.startsWith("https://example.test/"))).toBe(true);
  });
});

describe("check-deploy-health against a served page", () => {
  let active = null;
  afterEach(async () => {
    if (active) await new Promise(resolve => active.close(resolve));
    active = null;
  });

  async function serveBuild(stamp) {
    const served = await serve({
      "/PixelForge/": { type: "text/html; charset=utf-8", body: PAGE(stamp) },
      "/PixelForge/assets/index-abc.js": { type: "text/javascript", body: "console.log(1)" },
      "/PixelForge/assets/index-abc.css": { type: "text/css", body: "body{}" },
    });
    active = served.server;
    return served.baseUrl;
  }

  it("passes when the served build matches the expected stamp", async () => {
    const baseUrl = await serveBuild("abc123");
    await expect(checkOnce({ baseUrl, expectedBuild: "abc123" })).resolves.toBeUndefined();
  });

  it("fails when the served build is stale", async () => {
    const baseUrl = await serveBuild("older");
    await expect(checkOnce({ baseUrl, expectedBuild: "abc123" })).rejects.toThrow(/is build older, expected abc123/);
  });

  it("fails when the page carries no stamp but one is expected", async () => {
    const served = await serve({
      "/PixelForge/": { type: "text/html", body: PAGE("x").replace(/<meta name="pixelforge-build"[^>]*>/, "") },
    });
    active = served.server;
    await expect(checkOnce({ baseUrl: served.baseUrl, expectedBuild: "abc123" })).rejects.toThrow(/carries no pixelforge-build stamp/);
  });

  it("fails when a referenced asset is missing", async () => {
    const served = await serve({
      "/PixelForge/": { type: "text/html", body: PAGE("abc123") },
      "/PixelForge/assets/index-abc.css": { type: "text/css", body: "body{}" },
    });
    active = served.server;
    await expect(checkOnce({ baseUrl: served.baseUrl, expectedBuild: null })).rejects.toThrow(/index-abc\.js returned 404/);
  });
});
