import { useMemo, useState } from "react";
import { Brush, Check, ChevronLeft, ChevronRight, Layers, Monitor, Play, Sparkles, Type } from "lucide-react";
import { ROUTES } from "../routes.js";

const STEPS = [
  {
    eyebrow: "Welcome to",
    title: "PixelForge",
    body: "A browser-based studio for pixels, vectors, type, and AI generation on one layered canvas. Let's set up your workspace.",
  },
  {
    eyebrow: "Step 2 / Workspace",
    title: "Make it yours",
    body: "Pick a look and defaults. You can change any of this later from the editor.",
  },
  {
    eyebrow: "Step 3 / Tour",
    title: "The essentials",
    body: "Three things worth knowing before your first stroke.",
  },
  {
    eyebrow: "Step 4 / First canvas",
    title: "Your first canvas",
    body: "Choose a size to start with, or set custom dimensions in the editor.",
  },
];

const FEATURES = [
  { icon: Brush, title: "17 tools, one rail", detail: "Brush, shapes, type, selections, fills, and navigation stay on the left." },
  { icon: Layers, title: "Raster, vector, text", detail: "Stack layer types freely with blend modes, opacity, locks, and compatibility feedback." },
  { icon: Sparkles, title: "AI into layers", detail: "Generate imagery and place the result directly into a new raster layer." },
];

const SIZES = [
  { id: "sq", name: "Square", size: "2048 x 2048" },
  { id: "hd", name: "HD 1080p", size: "1920 x 1080" },
  { id: "story", name: "Story", size: "1080 x 1920" },
  { id: "post", name: "Portrait", size: "1080 x 1350" },
];

export default function OnboardingPage({ navigate }) {
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState("amber");
  const [units, setUnits] = useState("px");
  const [size, setSize] = useState("hd");
  const [done, setDone] = useState(false);
  const current = STEPS[step];
  const canGoBack = step > 0;
  const isLast = step === STEPS.length - 1;
  const completion = useMemo(() => ({
    theme,
    accent,
    units,
    size: SIZES.find(item => item.id === size)?.name || "HD 1080p",
  }), [accent, size, theme, units]);

  const next = () => {
    if (!isLast) setStep(step + 1);
    else setDone(true);
  };

  return (
    <main className={`pf-page pf-onboarding pf-route-onboarding theme-${theme} accent-${accent}`}>
      <div className="pf-ob-top">
        <button className="pf-brand-lockup compact" type="button" onClick={() => navigate(ROUTES.home)}>
          <span className="pf-brand-mark">P</span>
          <span><strong>PixelForge</strong><small>Onboarding</small></span>
        </button>
        {!done && <button className="pf-page-btn ghost" type="button" onClick={() => navigate(ROUTES.editor)}>Skip</button>}
      </div>

      {!done ? (
        <section className="pf-ob-shell">
          <div className="pf-ob-visual" aria-hidden="true">
            <div className="pf-ob-stage">
              {step === 0 && (
                <>
                  <div className="pf-ob-logo">P</div>
                  <span className="pixel p1" /><span className="pixel p2" /><span className="pixel p3" />
                  <p>A studio that fits in a browser tab</p>
                </>
              )}
              {step === 1 && (
                <div className="pf-ob-preview">
                  <span className="bar" />
                  <span className="block one" />
                  <span className="block two" />
                  <span className="block three" />
                  <p>{theme} / {accent} / {units}</p>
                </div>
              )}
              {step === 2 && (
                <div className="pf-ob-layer-stack">
                  {["Text", "Shapes", "AI: dawn sky", "Background"].map((name, index) => (
                    <span key={name}><i>{index === 0 ? <Type size={14} /> : index === 2 ? <Sparkles size={14} /> : <Layers size={14} />}</i>{name}<em>{[100, 78, 90, 100][index]}%</em></span>
                  ))}
                </div>
              )}
              {step === 3 && (
                <div className="pf-ob-canvas">
                  <Monitor size={42} />
                  <p>Fresh canvas, ready to work</p>
                </div>
              )}
            </div>
          </div>

          <div className="pf-ob-content">
            <div className="pf-ob-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((item, index) => <span key={item.title} className={index <= step ? "active" : ""} />)}
            </div>
            <div className="pf-page-eyebrow">{current.eyebrow}</div>
            <h1>{current.title === "PixelForge" ? <>Pixel<span>Forge</span></> : current.title}</h1>
            <p>{current.body}</p>

            {step === 1 && (
              <div className="pf-ob-controls">
                <fieldset><legend>Appearance</legend>{["dark", "light"].map(item => <button key={item} className={theme === item ? "active" : ""} type="button" onClick={() => setTheme(item)}>{item}</button>)}</fieldset>
                <fieldset><legend>Accent</legend>{["amber", "teal", "coral", "violet"].map(item => <button key={item} className={accent === item ? "active" : ""} type="button" onClick={() => setAccent(item)}>{item}</button>)}</fieldset>
                <fieldset><legend>Units</legend>{["px", "in", "mm"].map(item => <button key={item} className={units === item ? "active" : ""} type="button" onClick={() => setUnits(item)}>{item}</button>)}</fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="pf-ob-features">
                {FEATURES.map(feature => (
                  <div key={feature.title} className="pf-ob-feature">
                    <feature.icon size={18} />
                    <span><strong>{feature.title}</strong><small>{feature.detail}</small></span>
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="pf-ob-size-grid">
                {SIZES.map(item => (
                  <button key={item.id} className={size === item.id ? "active" : ""} type="button" onClick={() => setSize(item.id)}>
                    <span className={`pf-ratio-icon ratio-${item.id}`} />
                    <strong>{item.name}</strong>
                    <small>{item.size}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="pf-ob-actions">
              {canGoBack && <button className="pf-page-btn ghost" type="button" onClick={() => setStep(step - 1)}><ChevronLeft size={16} /> Back</button>}
              <button className="pf-page-btn primary" type="button" onClick={next}>
                {step === 0 ? "Get started" : isLast ? "Start creating" : "Continue"} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="pf-ob-complete">
          <Check size={30} />
          <div className="pf-page-eyebrow">Workspace saved</div>
          <h1>Ready to create</h1>
          <p>Opening a {completion.size.toLowerCase()} canvas with {completion.theme} mode, {completion.accent} accent, and {completion.units} units.</p>
          <div className="pf-page-actions">
            <button className="pf-page-btn primary" type="button" onClick={() => navigate(ROUTES.editor)}><Play size={16} /> Open Editor</button>
            <button className="pf-page-btn ghost" type="button" onClick={() => { setDone(false); setStep(0); }}>Replay onboarding</button>
          </div>
        </section>
      )}
    </main>
  );
}
