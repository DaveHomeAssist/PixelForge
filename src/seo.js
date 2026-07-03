import { normalizeRoute, ROUTES } from "./routes.js";

export const SITE_BASE_URL = "https://davehomeassist.github.io/PixelForge/";

const ROUTE_PATHS = {
  [ROUTES.home]: "",
  [ROUTES.templates]: "templates.html",
  [ROUTES.guide]: "guide.html",
  [ROUTES.onboarding]: "onboarding.html",
  [ROUTES.brand]: "brand.html",
  [ROUTES.editor]: "editor.html",
};

export const SEO_ROUTES = {
  [ROUTES.home]: {
    title: "PixelForge | Browser Pixel Art and Image Editor",
    description: "Create pixel art, layered raster edits, vector shapes, text, and AI-generated imagery in PixelForge, a browser-based editor for quick creative work.",
  },
  [ROUTES.templates]: {
    title: "PixelForge Templates | Start Pixel, UI, and Game Art Faster",
    description: "Browse PixelForge starter canvases for pixel character sheets, retro UI kits, tilesets, album covers, stream overlays, and emote packs.",
  },
  [ROUTES.guide]: {
    title: "PixelForge Guide | Tools, Layers, Export, and Shortcuts",
    description: "Learn PixelForge basics, including raster tools, vector shapes, text layers, image import, selections, AI generation, saving, export, and keyboard shortcuts.",
  },
  [ROUTES.onboarding]: {
    title: "PixelForge Onboarding | Set Up Your Creative Workspace",
    description: "Walk through PixelForge workspace setup, appearance choices, layer basics, AI features, and first-canvas options before opening the editor.",
  },
  [ROUTES.brand]: {
    title: "PixelForge Brand System | Pixel P Logo and Color Tokens",
    description: "Review the PixelForge Pixel P mark, lockups, wordmark treatments, app-icon usage, and color tokens used across the browser editor.",
  },
  [ROUTES.editor]: {
    title: "PixelForge Editor | Layered Raster, Vector, Text, and AI Canvas",
    description: "Open the PixelForge browser editor for layered painting, raster edits, vector shapes, text, image import, AI generation, project save, and image export.",
  },
};

function absoluteUrl(path) {
  return new URL(path, SITE_BASE_URL).href;
}

export function getCanonicalUrl(route) {
  const normalized = normalizeRoute(route);
  return absoluteUrl(ROUTE_PATHS[normalized] ?? ROUTE_PATHS[ROUTES.home]);
}

export function getSeoForRoute(route) {
  const normalized = normalizeRoute(route);
  return {
    ...SEO_ROUTES[normalized],
    route: normalized,
    canonicalUrl: getCanonicalUrl(normalized),
  };
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

function setMetaName(name, content) {
  upsertMeta(`meta[name="${name}"]`, { name, content });
}

function setMetaProperty(property, content) {
  upsertMeta(`meta[property="${property}"]`, { property, content });
}

function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

export function setDocumentSeo(route) {
  if (typeof document === "undefined") return;
  const seo = getSeoForRoute(route);
  document.title = seo.title;
  setCanonical(seo.canonicalUrl);
  setMetaName("description", seo.description);
  setMetaName("robots", "index,follow");
  setMetaName("twitter:card", "summary");
  setMetaName("twitter:title", seo.title);
  setMetaName("twitter:description", seo.description);
  setMetaProperty("og:site_name", "PixelForge");
  setMetaProperty("og:type", "website");
  setMetaProperty("og:title", seo.title);
  setMetaProperty("og:description", seo.description);
  setMetaProperty("og:url", seo.canonicalUrl);
}
