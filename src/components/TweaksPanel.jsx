import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import TweakSection from "./tweaks/TweakSection.jsx";
import TweakRadio from "./tweaks/TweakRadio.jsx";
import TweakSelect from "./tweaks/TweakSelect.jsx";
import TweakSlider from "./tweaks/TweakSlider.jsx";

/**
 * TweaksPanel
 *
 * Right-side drawer that slides in over the editor and exposes the eight
 * cosmetic axes managed by useTweaks (theme, accent, type, density, radius,
 * toolbar, panel, starter). Backdrop click and Escape close.
 *
 * PR 2 of the redesign cycle locks decision Q7: drawer surface, NOT a modal,
 * NOT a sidebar.
 *
 * Props:
 *   open       boolean - drawer visibility.
 *   onClose    () => void - called on backdrop click, Escape, or close button.
 *   tweaks     current tweaks object from useTweaks.
 *   setTweak   (key, value) => void from useTweaks.
 *   resetTweaks optional () => void from useTweaks.
 */

const ACCENT_OPTIONS = [
  { value: "amber", label: "Amber (warm)" },
  { value: "coral", label: "Coral (warm)" },
  { value: "teal", label: "Teal (cool)" },
  { value: "electric", label: "Electric (cool)" },
  { value: "lime", label: "Lime (acid)" },
  { value: "mono", label: "Monochrome" },
];

const TYPE_OPTIONS = [
  { value: "geist", label: "Geist (geometric)" },
  { value: "grotesk", label: "Inter (grotesk)" },
  { value: "editorial", label: "Inter + Instrument Serif" },
  { value: "mono", label: "Geist Mono (technical)" },
];

const TOOLBAR_OPTIONS = [
  { value: "grouped", label: "Grouped icon rail" },
  { value: "wide", label: "Wide with labels" },
  { value: "floating", label: "Floating pill (bottom)" },
];

const PANEL_OPTIONS = [
  { value: "stacked", label: "Stacked accordions" },
  { value: "tabbed", label: "Tabbed (Tool / Layers / Palette)" },
  { value: "hidden", label: "Hidden" },
];

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const STARTER_OPTIONS = [
  { value: "card", label: "Card" },
  { value: "strip", label: "Strip" },
  { value: "off", label: "Off" },
];

export default function TweaksPanel({ open, onClose, tweaks, setTweak, resetTweaks }) {
  // Wire Escape close. Effect always reads open; gates work inside.
  // No useEffectEvent per Q9.
  const handleKey = useCallback((e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="pf-tweaks-root" role="presentation">
      <div
        className="pf-tweaks-backdrop"
        data-testid="pf-tweaks-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="pf-tweaks-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Tweaks"
        data-testid="pf-tweaks-drawer"
      >
        <header className="pf-tweaks-head">
          <h2 className="pf-tweaks-title">Tweaks</h2>
          <button
            type="button"
            className="pf-tweaks-close"
            aria-label="Close tweaks"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </header>

        <div className="pf-tweaks-body">
          <TweakSection title="Theme">
            <TweakRadio
              label="Mode"
              value={tweaks.theme}
              onChange={(v) => setTweak("theme", v)}
              options={THEME_OPTIONS}
            />
            <TweakSelect
              label="Accent"
              value={tweaks.accent}
              onChange={(v) => setTweak("accent", v)}
              options={ACCENT_OPTIONS}
            />
          </TweakSection>

          <TweakSection title="Typography">
            <TweakSelect
              label="Family"
              value={tweaks.type}
              onChange={(v) => setTweak("type", v)}
              options={TYPE_OPTIONS}
            />
          </TweakSection>

          <TweakSection title="Layout">
            <TweakSelect
              label="Toolbar"
              value={tweaks.toolbar}
              onChange={(v) => setTweak("toolbar", v)}
              options={TOOLBAR_OPTIONS}
            />
            <TweakSelect
              label="Right panel"
              value={tweaks.panel}
              onChange={(v) => setTweak("panel", v)}
              options={PANEL_OPTIONS}
            />
            <TweakRadio
              label="Starter"
              value={tweaks.starter}
              onChange={(v) => setTweak("starter", v)}
              options={STARTER_OPTIONS}
            />
          </TweakSection>

          <TweakSection title="Density and shape">
            <TweakSlider
              label="Density"
              value={tweaks.density}
              min={0.85}
              max={1.2}
              step={0.05}
              onChange={(v) => setTweak("density", v)}
              format={(v) => `${Number(v).toFixed(2)}x`}
            />
            <TweakSlider
              label="Radius"
              value={tweaks.radius}
              min={0}
              max={20}
              step={1}
              onChange={(v) => setTweak("radius", v)}
              format={(v) => `${v}px`}
            />
          </TweakSection>
        </div>

        {resetTweaks && (
          <footer className="pf-tweaks-foot">
            <button
              type="button"
              className="pf-tweaks-reset"
              onClick={resetTweaks}
            >
              Reset to defaults
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
