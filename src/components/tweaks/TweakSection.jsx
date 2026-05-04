/**
 * TweakSection
 *
 * Section header + grouped wrapper for the TweaksPanel drawer. Renders the
 * uppercased title above its children. Children are typically TweakRadio,
 * TweakSelect, or TweakSlider.
 */
export default function TweakSection({ title, children }) {
  return (
    <section className="pf-tweak-section" aria-labelledby={`pf-tweak-${slug(title)}`}>
      <h3 id={`pf-tweak-${slug(title)}`} className="pf-tweak-section-title">{title}</h3>
      <div className="pf-tweak-section-body">{children}</div>
    </section>
  );
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
