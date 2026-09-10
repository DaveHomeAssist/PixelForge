import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";

// Build stamp written into index.html so the post-deploy health check can
// prove the published page is this build and not a stale earlier deploy.
// CI passes the commit through PIXELFORGE_BUILD_SHA; local builds fall back
// to the checked out HEAD and finally to "unknown".
function resolveBuildStamp() {
  const fromEnv = (process.env.PIXELFORGE_BUILD_SHA || process.env.GITHUB_SHA || "").trim();
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function buildStampPlugin() {
  const stamp = resolveBuildStamp();
  return {
    name: "pixelforge-build-stamp",
    transformIndexHtml(html) {
      return html.replace(
        "<title>",
        `<meta name="pixelforge-build" content="${stamp.replace(/"/g, "")}">\n    <title>`,
      );
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? "/PixelForge/",
  plugins: [buildStampPlugin()],
});
