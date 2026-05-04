/**
 * TweakSlider
 *
 * Row label plus a native <input type="range"> plus a formatted current-value
 * readout. Native range preserves keyboard support (left/right arrow, home,
 * end, page up/down) for free.
 *
 * Props:
 *   label    string.
 *   value    number.
 *   min      number.
 *   max      number.
 *   step     number; defaults to 1.
 *   onChange (number) => void.
 *   format   optional (number) => string for the readout. Defaults to String.
 */
export default function TweakSlider({ label, value, min, max, step = 1, onChange, format }) {
  const id = `pf-tweak-slider-${slug(label)}`;
  const display = typeof format === "function" ? format(value) : String(value);
  return (
    <div className="pf-tweak-row">
      <div className="pf-tweak-slider-head">
        <label htmlFor={id} className="pf-tweak-row-label">{label}</label>
        <span className="pf-tweak-slider-value">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        className="pf-tweak-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
