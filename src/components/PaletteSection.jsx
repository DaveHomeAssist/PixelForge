import { SWATCHES } from "../constants.js";

export default function PaletteSection({
  recentColors,
  color1,
  color2,
  color1Input,
  color2Input,
  setColor1Input,
  setColor2Input,
  applyPrimaryColor,
  applySecondaryColor,
  commitColor,
  feedbackClass,
  fieldFeedbackClass,
}) {
  return (
    <div className="pf-section">
      <div className="pf-section-head">Palette</div>
      <div className="pf-section-body">
        <div className="pf-section-lead">Click a swatch to set the primary color. Right-click a swatch to assign the secondary color, or edit the hex values directly.</div>
        {recentColors.length > 0 && (
          <div className="pf-recent-row">
            {recentColors.map(color => (
              <button
                key={color}
                className={`pf-chip-btn swatch ${feedbackClass("color-primary")}`}
                style={{ color }}
                title={color}
                onClick={() => applyPrimaryColor(color)}
                onContextMenu={e => { e.preventDefault(); applySecondaryColor(color); }}
              />
            ))}
          </div>
        )}
        <div className="pf-swatches">
          {SWATCHES.map(color => (
            <div
              key={color}
              className={`pf-swatch ${color.toLowerCase() === color1.toLowerCase() ? "primary" : ""} ${color.toLowerCase() === color2.toLowerCase() ? "secondary" : ""}`}
              style={{ background: color }}
              onClick={() => applyPrimaryColor(color)}
              onContextMenu={e => { e.preventDefault(); applySecondaryColor(color); }}
              title={color}
            />
          ))}
        </div>
        <div className="pf-hex-row">
          <input
            className={`pf-input ${fieldFeedbackClass("color1")}`}
            style={{ flex: 1 }}
            spellCheck={false}
            value={color1Input}
            onChange={e => setColor1Input(e.target.value)}
            onBlur={() => commitColor(1, color1Input)}
            onKeyDown={e => { if (e.key === "Enter") { commitColor(1, color1Input); e.currentTarget.blur(); } }}
            title="Primary"
            aria-label="Primary color hex value"
          />
          <input
            className={`pf-input ${fieldFeedbackClass("color2")}`}
            style={{ flex: 1 }}
            spellCheck={false}
            value={color2Input}
            onChange={e => setColor2Input(e.target.value)}
            onBlur={() => commitColor(2, color2Input)}
            onKeyDown={e => { if (e.key === "Enter") { commitColor(2, color2Input); e.currentTarget.blur(); } }}
            title="Secondary"
            aria-label="Secondary color hex value"
          />
        </div>
      </div>
    </div>
  );
}
