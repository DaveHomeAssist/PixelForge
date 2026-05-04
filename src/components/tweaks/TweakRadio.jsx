/**
 * TweakRadio
 *
 * Inline-segmented radio control. Renders a row label plus a horizontal group
 * of buttons; the active option carries aria-checked="true" and a visual
 * .active class.
 *
 * Props:
 *   label    string, displayed in the row label slot.
 *   value    current value (any primitive comparable with ===).
 *   options  Array<{ value, label }>.
 *   onChange (value) => void.
 *   name     optional radiogroup name; falls back to a slug of label.
 */
export default function TweakRadio({ label, value, options, onChange, name }) {
  const groupName = name || slug(label);
  return (
    <div className="pf-tweak-row">
      <div className="pf-tweak-row-label">{label}</div>
      <div className="pf-tweak-radio-group" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={active}
              data-name={groupName}
              className={`pf-tweak-radio ${active ? "active" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
