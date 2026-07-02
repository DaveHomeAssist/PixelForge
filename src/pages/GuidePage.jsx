import { ArrowUpRight, BookOpen, Brush, FileImage, Keyboard, Layers, Save, Sparkles, Type } from "lucide-react";
import { ROUTES, routeHref } from "../routes.js";

const SECTIONS = [
  { id: "start", title: "Getting Started" },
  { id: "interface", title: "Interface" },
  { id: "tools", title: "Tools" },
  { id: "layers", title: "Layers" },
  { id: "images", title: "Images" },
  { id: "text", title: "Text" },
  { id: "selection", title: "Selection" },
  { id: "ai", title: "AI Generate" },
  { id: "saving", title: "Saving" },
  { id: "shortcuts", title: "Shortcuts" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

function NavButton({ route, children, navigate, primary = false }) {
  return (
    <a
      className={`pf-page-btn ${primary ? "primary" : "ghost"}`}
      href={routeHref(route)}
      onClick={event => { event.preventDefault(); navigate(route); }}
    >
      {children}
    </a>
  );
}

export default function GuidePage({ navigate }) {
  return (
    <main className="pf-page pf-guide pf-route-guide">
      <header className="pf-guide-top">
        <button className="pf-brand-lockup compact" type="button" onClick={() => navigate(ROUTES.home)}>
          <span className="pf-brand-mark">P</span>
          <span><strong>PixelForge</strong><small>User Guide</small></span>
        </button>
        <div className="pf-page-actions">
          <NavButton route={ROUTES.home} navigate={navigate}>Home</NavButton>
          <NavButton route={ROUTES.editor} navigate={navigate} primary>Open Editor <ArrowUpRight size={15} /></NavButton>
        </div>
      </header>

      <section className="pf-guide-hero">
        <span className="pf-page-eyebrow"><BookOpen size={15} /> User Guide</span>
        <h1>The friendly guide to PixelForge</h1>
        <p>A browser-based drawing studio that blends raster painting, vector shapes, text, and AI generation on one layered canvas. Open it, draw something, save a project, or export a PNG.</p>
      </section>

      <div className="pf-guide-layout">
        <nav className="pf-guide-toc" aria-label="Guide contents">
          <strong>Contents</strong>
          {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
        </nav>

        <article className="pf-guide-content">
          <section id="start" className="pf-guide-card">
            <h2>Getting Started</h2>
            <ol>
              <li>Open PixelForge in your browser. Nothing installs and no account is required.</li>
              <li>Choose <strong>New</strong> to set canvas size and background, or accept the 1200 x 800 default.</li>
              <li>Pick a tool from the left rail and start drawing.</li>
              <li>Save a <code>.pforge</code> project file or export an image when ready.</li>
            </ol>
          </section>

          <section id="interface" className="pf-guide-card">
            <h2>Interface</h2>
            <div className="pf-guide-diagram">
              <span>Top menu: File / Edit / Image / View / Save / Export</span>
              <span>Tool rail</span>
              <span>Canvas viewport</span>
              <span>Tool / Layers / Properties / History</span>
              <span>Status bar</span>
            </div>
            <p>The right panel is tabbed for repeated work. On compact screens the controls stay reachable from the same tab model.</p>
          </section>

          <section id="tools" className="pf-guide-card">
            <h2><Brush size={20} /> Tools</h2>
            <div className="pf-guide-grid">
              <div><strong>Raster</strong><span>Brush, Eraser, Bucket, Gradient, Marquee, Lasso, Magic Wand.</span></div>
              <div><strong>Vector</strong><span>Rectangle, Ellipse, Polygon, Star, Line, Pen Path.</span></div>
              <div><strong>Universal</strong><span>Move, Hand, Text placement, Eyedropper, zoom, pan.</span></div>
            </div>
            <p>Tool/layer compatibility warnings appear when the active layer cannot accept the selected tool.</p>
          </section>

          <section id="layers" className="pf-guide-card">
            <h2><Layers size={20} /> Layers</h2>
            <p>PixelForge supports raster, vector, and text layers with visibility, lock, opacity, blend mode, reorder, duplicate, merge, and rasterize controls.</p>
            <ul>
              <li><strong>Raster</strong>: painted pixels, pasted images, generated images.</li>
              <li><strong>Vector</strong>: editable shapes and paths.</li>
              <li><strong>Text</strong>: editable type with font, size, weight, italic, color, and alignment.</li>
            </ul>
          </section>

          <section id="images" className="pf-guide-card">
            <h2><FileImage size={20} /> Working With Images</h2>
            <p>Import images by drag and drop, clipboard paste, or the File menu. Exports flatten visible layers to PNG, JPG, or WebP with scale, quality, background, and selected-region options.</p>
          </section>

          <section id="text" className="pf-guide-card">
            <h2><Type size={20} /> Text</h2>
            <p>Use the Text tool to place editable text layers. Press Enter to commit, Shift+Enter for a line break, or Esc to cancel. The Properties tab exposes text styling.</p>
          </section>

          <section id="selection" className="pf-guide-card">
            <h2>Selection</h2>
            <p>Marquee, lasso, and magic wand operate on raster layers. Copy, cut, paste, nudge, delete, and commit floating selections without changing vector or text layers.</p>
          </section>

          <section id="ai" className="pf-guide-card">
            <h2><Sparkles size={20} /> AI Generate</h2>
            <p>Bring your own Anthropic and Replicate keys. PixelForge stores keys only in browser local storage and places generated images into new raster layers.</p>
          </section>

          <section id="saving" className="pf-guide-card">
            <h2><Save size={20} /> Saving And Autosave</h2>
            <p><strong>Save</strong> writes a <code>.pforge</code> project file. Autosave keeps a recoverable draft in browser storage for up to 30 days and surfaces a recovery banner when available.</p>
          </section>

          <section id="shortcuts" className="pf-guide-card">
            <h2><Keyboard size={20} /> Keyboard Shortcuts</h2>
            <table>
              <tbody>
                <tr><th>B / E / R / T</th><td>Brush, Eraser, Rectangle, Text</td></tr>
                <tr><th>Space drag</th><td>Pan canvas temporarily</td></tr>
                <tr><th>Ctrl/Cmd+S</th><td>Save project</td></tr>
                <tr><th>Ctrl/Cmd+Z</th><td>Undo</td></tr>
                <tr><th>X</th><td>Swap primary and secondary colors</td></tr>
              </tbody>
            </table>
          </section>

          <section id="troubleshooting" className="pf-guide-card">
            <h2>Troubleshooting</h2>
            <ul>
              <li>If a tool does not draw, check the compatibility banner and active layer type.</li>
              <li>If export looks wrong, confirm hidden layers, opacity, blend modes, and selected-only export.</li>
              <li>If recovery appears, choose Recover to restore the autosaved draft or Discard to clear it.</li>
            </ul>
          </section>
        </article>
      </div>
    </main>
  );
}
