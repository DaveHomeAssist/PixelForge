export const ROUTES = {
  home: "home",
  templates: "templates",
  guide: "guide",
  onboarding: "onboarding",
  brand: "brand",
  editor: "editor",
};

const ROUTE_SET = new Set(Object.values(ROUTES));

const PATH_ALIASES = new Map([
  ["", ROUTES.home],
  ["index.html", ROUTES.home],
  ["home.html", ROUTES.home],
  ["pixelforge home.html", ROUTES.home],
  ["templates.html", ROUTES.templates],
  ["guide.html", ROUTES.guide],
  ["pixelforge guide.html", ROUTES.guide],
  ["onboarding.html", ROUTES.onboarding],
  ["pixelforge onboarding.html", ROUTES.onboarding],
  ["brand.html", ROUTES.brand],
  ["logo.html", ROUTES.brand],
  ["pixelforge logo.html", ROUTES.brand],
  ["editor.html", ROUTES.editor],
  ["pixelforge.html", ROUTES.editor],
]);

export function normalizeRoute(value) {
  const route = String(value || "").trim().toLowerCase().replace(/^#?\/?/, "").replace(/\/$/, "");
  return ROUTE_SET.has(route) ? route : ROUTES.home;
}

export function getRouteFromLocation(location) {
  const hashRoute = location.hash?.match(/^#\/?([^?]+)/)?.[1];
  if (hashRoute) return normalizeRoute(hashRoute);

  const queryRoute = new URLSearchParams(location.search || "").get("screen");
  if (queryRoute) return normalizeRoute(queryRoute);

  const leaf = decodeURIComponent((location.pathname || "").split("/").filter(Boolean).at(-1) || "").toLowerCase();
  return PATH_ALIASES.get(leaf) || ROUTES.home;
}

export function routeHref(route) {
  return `#/${normalizeRoute(route)}`;
}

export function navigateToRoute(route) {
  const nextHash = routeHref(route);
  if (window.location.hash === nextHash) {
    window.dispatchEvent(new Event("pixelforge:navigate"));
    return;
  }
  window.location.hash = nextHash;
}
