# PixelForge

**Live demo:** https://davehomeassist.github.io/PixelForge/

PixelForge is a lightweight browser-based drawing surface that mixes raster painting and vector shape layers in a single React app. Saves to a local `.pforge` project file, exports to PNG, autosaves to IndexedDB for crash recovery.

## Features

- Raster brush and eraser tools
- Vector rectangle, ellipse, and line tools
- Layers with visibility, opacity, and 12 blend modes
- Undo/redo (80-entry history)
- Project save/load via the File System Access API (browser download fallback)
- PNG export
- IndexedDB autosave with draft recovery
- Keyboard shortcuts for every tool
- Mobile/compact UI for small viewports

## Browser support

- **Chrome / Edge / Opera** — full features including `.pforge` save (File System Access API)
- **Firefox** — all features except direct file save; falls back to downloading
- **Safari** — same as Firefox

## Development

Requires Node 22+ and npm 10+.

```bash
npm install
npm run dev
```

Use Node 22, 23, or 24. The repo pins `22` in `.nvmrc` and `.node-version`, and install / build scripts now fail fast on unsupported runtimes instead of surfacing tool-specific crashes.

Build:
```bash
npm run build
```

Full local CI check (lint + test + build):
```bash
npm run ci
```

Deployment to GitHub Pages is handled by `.github/workflows/deploy-pages.yml` on every push to `main`.

## History

See [implementation_plan.txt](./implementation_plan.txt) for the stabilization log.

## License

[MIT](./LICENSE)
