# PixelForge — User Guide

PixelForge is a browser-based drawing app that mixes raster painting with vector shapes on a single layered canvas. Paint with a brush, place shapes, drop in photos, type headlines, generate images with AI — then save a project file or export a PNG.

No account. No upload. Everything stays in your browser.

---

## Contents

- [Getting started](#getting-started)
- [The interface](#the-interface)
- [Tools](#tools)
- [Layers](#layers)
- [Working with images](#working-with-images)
- [Text](#text)
- [Selection (marquee)](#selection-marquee)
- [AI generate](#ai-generate)
- [Saving and autosave](#saving-and-autosave)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Tips](#tips)
- [Browser support](#browser-support)
- [Troubleshooting](#troubleshooting)

---

## Getting started

1. Open PixelForge in your browser.
2. Click **New** (top left) to set canvas size and background, or accept the default 1200 × 800 white canvas.
3. Pick a tool from the left toolbar and start drawing.
4. Save anytime with **Save** (Chrome/Edge) or **Download** (Firefox/Safari). PixelForge also autosaves a draft — if your browser crashes, you'll be offered recovery next time.

If you're coming back to an unsaved project, PixelForge detects the autosaved draft and shows a recovery banner at the top right.

---

## The interface

```
┌─────────────────────────────────────────────────────────┐
│ [Menu: New Import Resize Open Save Export ✨ Undo Redo] │
├──────┬──────────────────────────────────┬──────────────┤
│ Tool │                                  │ Right panel: │
│ bar  │        Canvas viewport           │ - Suggested  │
│      │                                  │ - Tool       │
│ [B]  │                                  │ - Selection  │
│ [E]  │                                  │ - Colors     │
│ ...  │                                  │ - Layers     │
└──────┴──────────────────────────────────┴──────────────┘
```

- **Top menu** — document operations, undo/redo, zoom controls, ✨ AI generate
- **Left toolbar** — tools plus primary/secondary color wells
- **Canvas viewport** — the active document; pan with Space + drag, zoom with mouse wheel
- **Right panel** — context-sensitive sections for the active tool, selection, colors, and layers
- **Status bar** (bottom) — document size, zoom, active layer, save state

On small screens the right panel collapses to a tab strip (Next / Tool / Selection / Colors / Layers).

---

## Tools

| Icon | Tool | Shortcut | What it does |
|---|---|---|---|
| ◱ | **Move** | `V` | Drag whole layers or selected vector shapes |
| ⬚ | **Marquee** | `M` | Select a rectangle of pixels on a raster layer |
| ✎ | **Brush** | `B` | Paint with color, size, opacity, and a preset style |
| ✕ | **Eraser** | `E` | Erase pixels from a raster layer |
| ▢ | **Rectangle** | `R` | Draw a rectangle on a vector layer |
| ○ | **Ellipse** | `O` | Draw an ellipse or circle |
| ─ | **Line** | `L` | Draw a straight line |
| **T** | **Text** | `T` | Click to place an editable text layer |
| ◉ | **Eyedropper** | `I` | Sample a color from the canvas into the primary well |

Each tool shows help and options in the right-panel **Tool** section when active.

### Brush presets

The Brush has four built-in styles:

- **Soft** — smooth round brush with opacity buildup (the default)
- **Pencil** — hard-edged, pixel-exact, ignores opacity for solid lines
- **Spray** — airbrush dots distributed across the brush radius
- **Marker** — layered ellipse passes with `multiply` blending for ink-like strokes

Pick a preset from the row at the top of the Tool panel when Brush is active. Your choice sticks between sessions.

### Color wells

Two color wells (Primary **P** and Secondary **S**) live next to the toolbar.

- Click a well to open the native color picker
- `X` swaps primary and secondary
- In the **Colors** panel, use recent colors or 24 starter swatches, or type a hex value

---

## Layers

PixelForge supports **three layer types**:

- **Raster** — a pixel canvas, painted with brush/eraser or filled with an image
- **Vector** — an ordered list of shapes (rectangle, ellipse, line)
- **Text** — an editable string with font, size, weight, italic, color, and alignment

Each layer has **visibility**, **opacity** (0–100%), a **blend mode** (12 options from `source-over` through `difference`), and a **lock**. Layers stack bottom-to-top; higher entries in the Layers panel render on top.

### Layer actions (right panel → Layers section)

- **+ Raster / + Vector / + Text** — add a new empty layer
- **Duplicate** — copy the active layer with offset
- **Merge Down** — flatten the active layer onto the raster below it (only between adjacent raster layers)
- **↑ / ↓** — reorder
- **Drag** any layer row to reorder by drop
- **Rename** — edit the name at the top of the Layers section
- **Lock** — prevent accidental edits
- **Hide** — toggle visibility without deleting

---

## Working with images

### Three ways to import

1. **Drag-and-drop** — drag an image file onto the canvas viewport. Drop multiple images at once to create one layer per file.
2. **Clipboard paste** — press `Ctrl+V` (`Cmd+V` on Mac) with an image in your clipboard (e.g., a screenshot from Snipping Tool or macOS Screenshot). PixelForge adds it as a new layer named "Pasted Image".
3. **Import menu** — **Menu → Import** opens a file picker.

All three paths scale the image to fit the document, center it, and add it as a raster layer above the active one. Each import is one undo step.

### Export

**Menu → Export PNG** flattens all visible layers and downloads `export.png`. Layer opacity and blend modes are respected.

To export only some layers, hide the others first.

---

## Text

1. Pick the Text tool (`T`) and click anywhere on the canvas.
2. A text overlay opens with default "Text" selected — type to replace it.
3. Press **Enter** to commit (or click outside). Press **Shift+Enter** for a line break.
4. Press **Esc** to cancel; if the text is empty, the layer is deleted.

With a text layer selected, the right-panel **Text** section lets you change:

- **Font** — 8 options: 4 system fonts (Sans, Serif, Mono, Arial) + 4 Google Fonts (Inter, Playfair, JetBrains Mono, Roboto)
- **Size** — 8px to 256px
- **Weight** — Regular / Bold
- **Italic** — toggle
- **Color** — any hex color
- **Align** — left / center / right

Click **Edit Text** (or switch to Move tool and double-click the text — coming soon) to reopen the editor.

Move a text layer with the Move tool. Text layers save/load through the `.pforge` file and survive undo/redo.

---

## Selection (marquee)

The marquee tool cuts, copies, and moves regions of pixels.

1. Pick the Marquee tool (`M`).
2. Drag a rectangle over part of a raster layer. The marching-ants border confirms selection.
3. Inside the selection, drag to **move** the pixels. They lift and float until you release or press Esc.

**Keyboard ops** (while a marquee is active):

| Keys | Action |
|---|---|
| `Ctrl+C` / `Cmd+C` | Copy pixels to internal clipboard |
| `Ctrl+X` / `Cmd+X` | Cut (copy + clear region) |
| `Ctrl+V` / `Cmd+V` | Paste as a new raster layer |
| `Delete` / `Backspace` | Clear pixels in the selection |
| `Esc` | Commit any move, then deselect |
| `←↑↓→` | Nudge selection 1 pixel (hold **Shift** for 10) |

Switching to any other tool commits a floating selection automatically — no "accidentally lost my move" moment.

Notes:
- The marquee operates on the **active raster layer**. Vector and text layers are ignored.
- The clipboard is internal to PixelForge; it doesn't write to your OS clipboard.
- Pasting anywhere in PixelForge with an image in your system clipboard still imports that image (drag-drop style).

---

## AI generate

PixelForge can generate images from a text prompt directly into a new layer. You bring your own API keys — nothing is uploaded or hosted by PixelForge.

### First-time setup

1. Click **✨ Generate** in the top menu.
2. Click **Settings** (opens the AI Settings modal).
3. Paste your **Anthropic API key** (used to refine the prompt).
4. Paste your **Replicate API key** (used to render the image).
5. Click **Save**. Keys are stored in this browser's local storage only.

Get keys from:
- **Anthropic:** https://console.anthropic.com/ → API Keys
- **Replicate:** https://replicate.com/account/api-tokens

Your keys never leave your browser, never enter `.pforge` save files, and never enter autosaved drafts.

### Generating

1. Click **✨ Generate**.
2. Type a short prompt. "Foggy mountain at dawn, watercolor" works fine — Claude refines it into a detailed prompt before sending.
3. Pick an aspect ratio (1:1, 3:2, 2:3, 16:9).
4. Click **Generate**. Allow 10–60 seconds depending on the model and server load.
5. The result lands as a new raster layer named `AI: {prompt}`.

**Cancel** stops in-flight requests. **Settings** reopens the keys modal without losing your prompt.

### Clearing keys

Open AI Settings and click **Clear keys**. This wipes the namespace; all future generations will need keys re-entered.

### Costs

Each generation makes two calls:
1. One Claude API call (prompt refinement, prompt-cached after the first call — very cheap)
2. One Replicate prediction (pricing depends on model; SDXL is ~$0.001–0.01 per image)

PixelForge does not track or limit your usage. Monitor your provider dashboards.

---

## Saving and autosave

### Project files

**Save** (`Ctrl+S` / `Cmd+S`) writes a `.pforge` file.

- **Chrome / Edge / Opera** — saves directly to the same file on subsequent saves (File System Access API)
- **Firefox / Safari** — downloads a new copy each time (browser limitation)

`.pforge` is a JSON file with embedded PNG data. It round-trips all layers (raster pixels, vector shapes, text) without loss. Files from older versions of PixelForge (v1 and v2) still open.

### Autosave

PixelForge continuously autosaves a draft to your browser's IndexedDB. If you close the tab with unsaved changes, reopening within 30 days shows a recovery banner. Click **Recover** to restore.

Discarding the recovered draft, or saving/reloading a fresh project, clears the autosave slot.

**The autosave never includes AI API keys.**

---

## Keyboard shortcuts

### Tools
| Key | Tool |
|---|---|
| `V` | Move |
| `M` | Marquee |
| `B` | Brush |
| `E` | Eraser |
| `R` | Rectangle |
| `O` | Ellipse |
| `L` | Line |
| `T` | Text |
| `I` | Eyedropper |

### Editing
| Keys | Action |
|---|---|
| `Ctrl/Cmd + Z` | Undo (up to 80 steps) |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + D` | Duplicate selected shape, or duplicate active layer if no shape is selected |
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + C` / `X` / `V` | Copy / cut / paste (marquee selection or clipboard image) |
| `Delete` / `Backspace` | Delete selected shape or clear marquee |
| `Esc` | Deselect / commit floating marquee / cancel text edit |
| `X` | Swap primary/secondary colors |
| `[` / `]` | Decrease / increase brush size |
| `←↑↓→` | Nudge marquee selection 1 px (+Shift = 10 px) |

### Viewport
| Keys | Action |
|---|---|
| `Space + drag` | Pan viewport |
| Mouse wheel | Zoom to cursor |
| (Menu) | Zoom in / out / Fit |

### Text edit (when overlay is open)
| Keys | Action |
|---|---|
| `Enter` | Commit |
| `Shift + Enter` | New line |
| `Esc` | Cancel |

---

## Tips

- **Hold `Space` while using any tool** to temporarily pan. Your tool comes back on release.
- **Switch between raster and vector work quickly** — PixelForge highlights the "likely" layer in the Layers panel based on your current tool. Click that highlight or let the app auto-switch.
- **Use the Starter Actions card** on a blank canvas — it offers "Paint", "Drop shapes", "Import an image", and "Generate with AI" as one-click starts.
- **Blend modes** live in the Layers section under each layer's row. `Multiply` darkens, `Screen` lightens, `Overlay` adds contrast — same as Photoshop.
- **Lock the background layer** before detailed work to avoid accidental edits.
- **Fit the canvas to view** with the **Fit** button in the top-right menu or pick it from zoom controls.
- **Drag-drop beats Import** for quick reference images — just drop the file onto the canvas.
- **Undo is generous** (80 steps) — experiment freely.

---

## Browser support

| Browser | Notes |
|---|---|
| **Chrome / Edge / Opera** | Full support including direct `.pforge` file save |
| **Firefox** | All features; save falls back to download |
| **Safari** | All features; save falls back to download |

PixelForge requires a modern browser with Canvas 2D, IndexedDB, and File System Access API support (the last one is optional — fallback works everywhere).

**Known issues:**
- On iOS Safari, complex brush strokes on large canvases may stutter
- Google Fonts (Inter, Playfair, JetBrains Mono, Roboto) require an internet connection to load on first use

---

## Troubleshooting

**"I lost my work after closing the tab."**
Reopen PixelForge. If your browser's IndexedDB is intact, you'll see a Recover banner at the top right. Click Recover.

**"My saved file won't open."**
PixelForge loads `.pforge` files (JSON). If you renamed or truncated the file, open it in a text editor to verify it starts with `{"v":`. Files from versions 1–3 are supported.

**"The canvas is blank after drawing."**
Check that the active layer is **visible** (eye icon not crossed out) and has **opacity > 0** in the Layers panel. Blend modes like `multiply` on a fully-transparent canvas can also produce no visible output.

**"The Brush tool flashes red and says 'Select a raster layer'."**
The Brush works only on raster layers. Add one via **+ Raster** in the Layers section, or let PixelForge auto-switch by clicking the highlighted layer.

**"AI Generate says 'Set your API keys'."**
Open **✨ Generate → Settings** and paste both keys. They're kept in this browser only.

**"AI generation failed."**
- Check your key validity on the provider dashboard
- Check your provider balance/quota
- Check your browser console for CORS or network errors
- Try a simpler prompt or smaller aspect ratio

**"The .pforge file saved but didn't update next time I saved."**
Firefox and Safari don't support direct file-save; each save downloads a new copy. Use Chrome/Edge/Opera for edit-and-save workflow against a single file.

**"Text layer looks like a default system font, not the Google Font I picked."**
Give Google Fonts a moment to load on first open. If the connection is slow, the fallback system font renders briefly.

---

## Where to learn more

- **Live app:** https://davehomeassist.github.io/PixelForge/
- **Source:** https://github.com/DaveHomeAssist/PixelForge
- **License:** MIT
