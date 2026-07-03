import { afterEach, describe, expect, it } from "vitest";
import { getCanonicalUrl, getSeoForRoute, setDocumentSeo, SITE_BASE_URL } from "../seo.js";
import { ROUTES } from "../routes.js";

describe("SEO route metadata", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("returns canonical public URLs for primary routes", () => {
    expect(SITE_BASE_URL).toBe("https://davehomeassist.github.io/PixelForge/");
    expect(getCanonicalUrl(ROUTES.home)).toBe("https://davehomeassist.github.io/PixelForge/");
    expect(getCanonicalUrl(ROUTES.guide)).toBe("https://davehomeassist.github.io/PixelForge/guide.html");
    expect(getCanonicalUrl(ROUTES.editor)).toBe("https://davehomeassist.github.io/PixelForge/editor.html");
  });

  it("falls back to home SEO for unknown routes", () => {
    const seo = getSeoForRoute("missing");
    expect(seo.route).toBe(ROUTES.home);
    expect(seo.canonicalUrl).toBe("https://davehomeassist.github.io/PixelForge/");
    expect(seo.title).toContain("PixelForge");
  });

  it("updates document title, canonical, description, and social tags", () => {
    setDocumentSeo(ROUTES.templates);

    expect(document.title).toBe("PixelForge Templates | Start Pixel, UI, and Game Art Faster");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://davehomeassist.github.io/PixelForge/templates.html",
    );
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toContain("starter canvases");
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://davehomeassist.github.io/PixelForge/templates.html",
    );
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute("content")).toBe("summary");
  });
});
