import { useState } from "react";
import {
  ArrowUpRight, Badge, BookOpen, Clock3, FileText, FolderOpen, Home, Layers, Monitor,
  Palette, Play, Plus, Search, Upload,
} from "lucide-react";
import { ROUTES, routeHref } from "../routes.js";

const QUICK = [
  { id: "sq", name: "Square", size: "2048 x 2048", ratio: "1:1" },
  { id: "port", name: "Portrait", size: "1080 x 1350", ratio: "4:5" },
  { id: "land", name: "Landscape", size: "1920 x 1080", ratio: "16:9" },
  { id: "story", name: "Story", size: "1080 x 1920", ratio: "9:16" },
];

const TEMPLATES = [
  { id: "sprite", name: "Pixel Character Sheet", dim: "64 x 64", cat: "Game Art", tag: "sprite sheet", tone: "coral" },
  { id: "retro", name: "Retro UI Kit", dim: "1920 x 1080", cat: "Interface", tag: "ui kit", tone: "blue" },
  { id: "tiles", name: "Isometric Tileset", dim: "512 x 512", cat: "Game Art", tag: "tileset", tone: "green" },
  { id: "cover", name: "Album Cover", dim: "3000 x 3000", cat: "Print", tag: "cover art", tone: "violet" },
  { id: "stream", name: "Twitch Overlay", dim: "1920 x 1080", cat: "Stream", tag: "overlay", tone: "amber" },
  { id: "emote", name: "Emote Pack", dim: "112 x 112", cat: "Stream", tag: "emotes", tone: "pink" },
];

const RECENT_FILES = [
  { id: "forest", name: "forest-parallax.pforge", dim: "1920 x 1080", edited: "12 min ago", size: "4.2 MB" },
  { id: "sprite", name: "hero-sprite-v3.pforge", dim: "128 x 128", edited: "2 hours ago", size: "890 KB" },
  { id: "menu", name: "menu-mockup.png", dim: "1440 x 1024", edited: "Yesterday", size: "2.1 MB" },
  { id: "tiles", name: "tileset-dungeon.pforge", dim: "512 x 512", edited: "Yesterday", size: "3.6 MB" },
];

const PRESETS = [
  { id: "hd", name: "HD 1080p", w: 1920, h: 1080 },
  { id: "ig", name: "Instagram Post", w: 1080, h: 1080 },
  { id: "story", name: "Story", w: 1080, h: 1920 },
  { id: "desk", name: "Desktop", w: 1440, h: 1024 },
  { id: "og", name: "Social Preview", w: 1200, h: 630 },
  { id: "letter", name: "US Letter", w: 2550, h: 3300 },
];

function PageLink({ route, active, children, navigate }) {
  return (
    <a
      className={`pf-launch-nav-link ${active ? "active" : ""}`}
      href={routeHref(route)}
      onClick={event => { event.preventDefault(); navigate(route); }}
    >
      {children}
    </a>
  );
}

function NewProjectModal({ draft, setDraft, close, create }) {
  return (
    <div className="pf-page-modal-backdrop" role="presentation" onMouseDown={close}>
      <div className="pf-page-modal" role="dialog" aria-modal="true" aria-label="New Project" onMouseDown={event => event.stopPropagation()}>
        <div className="pf-page-modal-head">
          <div>
            <div className="pf-page-eyebrow">New Project</div>
            <h2>Choose a starting canvas</h2>
          </div>
          <button className="pf-page-icon-btn" type="button" onClick={close} aria-label="Close new project">x</button>
        </div>
        <div className="pf-preset-grid">
          {PRESETS.map(preset => (
            <button
              key={preset.id}
              className={`pf-preset-card ${draft.preset === preset.id ? "active" : ""}`}
              type="button"
              onClick={() => setDraft({ ...draft, preset: preset.id, width: preset.w, height: preset.h })}
            >
              <span>{preset.name}</span>
              <strong>{preset.w} x {preset.h}</strong>
            </button>
          ))}
        </div>
        <div className="pf-modal-fields">
          <label>
            <span>Width</span>
            <input value={draft.width} inputMode="numeric" onChange={event => setDraft({ ...draft, width: event.target.value })} />
          </label>
          <label>
            <span>Height</span>
            <input value={draft.height} inputMode="numeric" onChange={event => setDraft({ ...draft, height: event.target.value })} />
          </label>
          <label>
            <span>Background</span>
            <select value={draft.background} onChange={event => setDraft({ ...draft, background: event.target.value })}>
              <option value="white">White</option>
              <option value="transparent">Transparent</option>
              <option value="dark">Dark</option>
              <option value="accent">Accent</option>
            </select>
          </label>
        </div>
        <div className="pf-page-modal-actions">
          <button className="pf-page-btn ghost" type="button" onClick={close}>Cancel</button>
          <button className="pf-page-btn primary" type="button" onClick={create}>Create In Editor</button>
        </div>
      </div>
    </div>
  );
}

export default function LauncherPage({ navigate, initialView = "home" }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({ preset: "hd", width: 1920, height: 1080, background: "white" });
  const isTemplates = initialView === "templates";
  const createProject = () => {
    try {
      window.sessionStorage.setItem("PixelForge.launchDraft.v1", JSON.stringify(draft));
    } catch {
      // Non-critical; the editor remains available even if storage is disabled.
    }
    navigate(ROUTES.editor);
  };

  return (
    <main className={`pf-page pf-launch pf-route-${isTemplates ? "templates" : "home"}`}>
      <aside className="pf-launch-sidebar" aria-label="PixelForge launcher navigation">
        <button className="pf-brand-lockup" type="button" onClick={() => navigate(ROUTES.home)}>
          <span className="pf-brand-mark">P</span>
          <span>
            <strong>PixelForge</strong>
            <small>v3.2 studio</small>
          </span>
        </button>
        <nav className="pf-launch-nav">
          <PageLink route={ROUTES.home} active={!isTemplates} navigate={navigate}><Home size={16} /> Home</PageLink>
          <PageLink route={ROUTES.templates} active={isTemplates} navigate={navigate}><Layers size={16} /> Templates</PageLink>
          <PageLink route={ROUTES.guide} navigate={navigate}><BookOpen size={16} /> User Guide</PageLink>
          <PageLink route={ROUTES.onboarding} navigate={navigate}><Play size={16} /> Onboarding</PageLink>
          <PageLink route={ROUTES.brand} navigate={navigate}><Badge size={16} /> Brand</PageLink>
        </nav>
        <button className="pf-page-btn primary wide" type="button" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New Project
        </button>
        <button className="pf-page-btn ghost wide" type="button" onClick={() => navigate(ROUTES.editor)}>
          <ArrowUpRight size={16} /> Open Editor
        </button>
      </aside>

      <section className="pf-launch-main">
        <div className="pf-launch-top">
          <div>
            <div className="pf-page-eyebrow">PixelForge launch</div>
            <h1>{isTemplates ? "Templates" : "Good afternoon, Dave"}</h1>
          </div>
          <label className="pf-launch-search">
            <Search size={16} />
            <input placeholder="Search projects, templates, assets..." />
          </label>
        </div>

        {!isTemplates ? (
          <>
            <section className="pf-hero-panel">
              <div>
                <span className="pf-page-eyebrow">Start faster</span>
                <h2>Pixels, vectors, type, and AI on one layered canvas.</h2>
                <p>Open the editor, create a preset canvas, or run onboarding before your first stroke.</p>
                <div className="pf-page-actions">
                  <button className="pf-page-btn primary" type="button" onClick={() => navigate(ROUTES.editor)}><Monitor size={16} /> Open Editor</button>
                  <button className="pf-page-btn ghost" type="button" onClick={() => navigate(ROUTES.onboarding)}><Play size={16} /> Run Onboarding</button>
                </div>
              </div>
              <div className="pf-hero-art" aria-hidden="true">
                <span className="shape one" />
                <span className="shape two" />
                <span className="shape three" />
                <span className="layer a">Text</span>
                <span className="layer b">Shapes</span>
                <span className="layer c">Background</span>
              </div>
            </section>

            <section className="pf-launch-section">
              <div className="pf-section-title-row">
                <div><span className="pf-page-eyebrow">Quick create</span><h2>Start something new</h2></div>
                <button className="pf-page-btn ghost" type="button" onClick={() => setModalOpen(true)}><Plus size={15} /> Custom</button>
              </div>
              <div className="pf-quick-grid">
                {QUICK.map(item => (
                  <button key={item.id} className="pf-quick-card" type="button" onClick={() => {
                    const [width, height] = item.size.split(" x ").map(Number);
                    setDraft({ preset: item.id, width, height, background: "white" });
                    setModalOpen(true);
                  }}>
                    <span className={`pf-ratio-icon ratio-${item.id}`} />
                    <strong>{item.name}</strong>
                    <small>{item.size} / {item.ratio}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="pf-launch-section">
              <div className="pf-section-title-row">
                <div><span className="pf-page-eyebrow">Jump back in</span><h2>Recent files</h2></div>
                <button className="pf-page-btn ghost" type="button"><FolderOpen size={15} /> Browse</button>
              </div>
              <div className="pf-recent-list">
                {RECENT_FILES.map(file => (
                  <button key={file.id} className="pf-recent-file" type="button" onClick={() => navigate(ROUTES.editor)}>
                    <span className="pf-file-thumb"><FileText size={16} /></span>
                    <span><strong>{file.name}</strong><small>{file.dim}</small></span>
                    <span><Clock3 size={13} /> {file.edited}</span>
                    <span>{file.size}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="pf-launch-section">
            <div className="pf-section-title-row">
              <div><span className="pf-page-eyebrow">Template gallery</span><h2>Designed starts</h2></div>
              <button className="pf-page-btn ghost" type="button" onClick={() => setModalOpen(true)}><Upload size={15} /> Import</button>
            </div>
            <div className="pf-template-grid">
              {TEMPLATES.map(template => (
                <button key={template.id} className="pf-template-card" type="button" onClick={() => setModalOpen(true)}>
                  <span className={`pf-template-preview ${template.tone}`}><Palette size={22} /></span>
                  <span className="pf-template-copy">
                    <small>{template.cat} / {template.tag}</small>
                    <strong>{template.name}</strong>
                    <em>{template.dim}</em>
                  </span>
                  <span className="pf-template-open">Use template <ArrowUpRight size={13} /></span>
                </button>
              ))}
            </div>
          </section>
        )}
      </section>

      {modalOpen && (
        <NewProjectModal
          draft={draft}
          setDraft={setDraft}
          close={() => setModalOpen(false)}
          create={createProject}
        />
      )}
    </main>
  );
}
