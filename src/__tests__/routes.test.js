import { describe, expect, it } from "vitest";
import { getRouteFromLocation, normalizeRoute, routeHref, ROUTES } from "../routes.js";

function makeLocation(pathname, hash = "", search = "") {
  return { pathname, hash, search };
}

describe("routes", () => {
  it("normalizes known hash routes and falls back to home", () => {
    expect(normalizeRoute("#/editor")).toBe(ROUTES.editor);
    expect(normalizeRoute("/guide")).toBe(ROUTES.guide);
    expect(normalizeRoute("templates")).toBe(ROUTES.templates);
    expect(normalizeRoute("missing")).toBe(ROUTES.home);
  });

  it("maps clean and prototype endpoint filenames", () => {
    expect(getRouteFromLocation(makeLocation("/PixelForge/guide.html"))).toBe(ROUTES.guide);
    expect(getRouteFromLocation(makeLocation("/PixelForge/PixelForge Guide.html"))).toBe(ROUTES.guide);
    expect(getRouteFromLocation(makeLocation("/PixelForge/PixelForge Onboarding.html"))).toBe(ROUTES.onboarding);
    expect(getRouteFromLocation(makeLocation("/PixelForge/PixelForge Logo.html"))).toBe(ROUTES.brand);
    expect(getRouteFromLocation(makeLocation("/PixelForge/brand.html"))).toBe(ROUTES.brand);
    expect(getRouteFromLocation(makeLocation("/PixelForge/PixelForge.html"))).toBe(ROUTES.editor);
  });

  it("lets hash routes override static aliases", () => {
    expect(getRouteFromLocation(makeLocation("/PixelForge/guide.html", "#/editor"))).toBe(ROUTES.editor);
  });

  it("generates stable hash hrefs", () => {
    expect(routeHref(ROUTES.onboarding)).toBe("#/onboarding");
    expect(routeHref("not-real")).toBe("#/home");
  });
});
