/**
 * TweakSelect
 *
 * Row label plus a native <select>. Native select preserves keyboard support
 * and screen-reader labels for free.
 *
 * Props:
 *   label    string.
 *   value    current value.
 *   options  Array<{ value, label }>.
 *   onChange (value) => void.
 */
export default function TweakSelect({ label, value, options, onChange }) {
  const id = `pf-tweak-select-${slug(label)}`;
  return (
    <div className="pf-tweak-row">
      <label className="pf-tweak-row-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="pf-tweak-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
