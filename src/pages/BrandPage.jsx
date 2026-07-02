import { ArrowUpRight, Badge, Copy, Layers, Palette } from "lucide-react";
import { ROUTES, routeHref } from "../routes.js";

const COLORS = [
  { name: "Forge Amber", value: "#f5a623" },
  { name: "Hot Edge", value: "#e8622a" },
  { name: "Ink", value: "#17181b" },
  { name: "Canvas", value: "#f4f3ef" },
  { name: "Teal Accent", value: "#55c8b0" },
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

function PixelMark({ solid = false }) {
  return (
    <span className={`pf-brand-pixel-mark ${solid ? "solid" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
      <strong>P</strong>
    </span>
  );
}

export default function BrandPage({ navigate }) {
  return (
    <main className="pf-page pf-brand-page pf-route-brand">
      <header className="pf-guide-top">
        <button className="pf-brand-lockup compact" type="button" onClick={() => navigate(ROUTES.home)}>
          <span className="pf-brand-mark">P</span>
          <span><strong>PixelForge</strong><small>Brand System</small></span>
        </button>
        <div className="pf-page-actions">
          <NavButton route={ROUTES.home} navigate={navigate}>Home</NavButton>
          <NavButton route={ROUTES.editor} navigate={navigate} primary>Open Editor <ArrowUpRight size={15} /></NavButton>
        </div>
      </header>

      <section className="pf-guide-hero pf-brand-hero">
        <span className="pf-page-eyebrow"><Badge size={15} /> Logo Exploration</span>
        <h1>PixelForge brand system</h1>
        <p>The chosen Pixel P mark, primary lockups, wordmark treatments, color tokens, and app-icon usage captured as a shipped route.</p>
      </section>

      <section className="pf-brand-grid">
        <div className="pf-brand-card wide">
          <div className="pf-page-eyebrow">01 / Chosen mark</div>
          <div className="pf-mark-showcase">
            <PixelMark />
            <div>
              <h2>Pixel P</h2>
              <p>A block-built monogram with a warm forge gradient. It scales down to app-icon sizes and stays recognizable in one color.</p>
            </div>
          </div>
        </div>

        <div className="pf-brand-card dark-lockup">
          <div className="pf-page-eyebrow">02 / Primary lockup dark</div>
          <div className="pf-brand-lockup-demo"><PixelMark /><span>Pixel<strong>Forge</strong></span></div>
        </div>

        <div className="pf-brand-card light-lockup">
          <div className="pf-page-eyebrow">03 / Primary lockup light</div>
          <div className="pf-brand-lockup-demo"><PixelMark /><span>Pixel<strong>Forge</strong></span></div>
        </div>

        <div className="pf-brand-card wide">
          <div className="pf-page-eyebrow"><Copy size={14} /> 04 / Wordmark variants</div>
          <div className="pf-wordmark-grid">
            <span className="brand-word primary">Pixel<strong>Forge</strong></span>
            <span className="brand-word mono">pixelforge</span>
            <span className="brand-word tight">PixelForge</span>
            <span className="brand-word caps">PIXELFORGE</span>
          </div>
        </div>

        <div className="pf-brand-card">
          <div className="pf-page-eyebrow"><Palette size={14} /> Color tokens</div>
          <div className="pf-brand-swatches">
            {COLORS.map(color => (
              <span key={color.name}>
                <i style={{ background: color.value }} />
                <strong>{color.name}</strong>
                <small>{color.value}</small>
              </span>
            ))}
          </div>
        </div>

        <div className="pf-brand-card">
          <div className="pf-page-eyebrow"><Layers size={14} /> Mark usage</div>
          <div className="pf-brand-usage">
            <span><PixelMark /><small>Gradient app mark</small></span>
            <span><PixelMark solid /><small>Single-color mark</small></span>
            <span className="light"><PixelMark solid /><small>Light surface</small></span>
          </div>
        </div>
      </section>
    </main>
  );
}
