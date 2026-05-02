import { useEffect, useMemo, useState } from "react";
import {
  formatHex, hslToRgb, hsvToRgb, parseHex, rgbToHsl, rgbToHsv,
} from "../colorOps.js";

const TABS = ["HEX", "RGB", "HSL", "HSV"];
const PANEL_W = 320;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function fixedPosition(anchorRect) {
  if (!anchorRect || typeof window === "undefined") return { top: 80, left: 20 };
  if (window.innerWidth <= 640) {
    return {
      left: 12,
      right: 12,
      bottom: 12,
      width: "auto",
      maxHeight: "calc(100vh - 24px)",
    };
  }
  return {
    top: Math.max(12, Math.min(window.innerHeight - 420, anchorRect.bottom + 8)),
    left: Math.max(12, Math.min(window.innerWidth - PANEL_W - 12, anchorRect.left)),
    width: PANEL_W,
  };
}

function numberInput(label, value, min, max, onChange) {
  return (
    <label className="pf-color-picker-field" key={label}>
      <span>{label}</span>
      <input
        className="pf-input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </label>
  );
}

export default function ColorPickerPopover({
  open,
  value,
  anchorRect,
  onChange,
  onClose,
  palettesApi,
}) {
  const [tab, setTab] = useState("HEX");
  const [paletteName, setPaletteName] = useState("Custom Palette");
  const rgb = parseHex(value) || { r: 0, g: 0, b: 0 };
  const hex = formatHex(rgb);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const style = useMemo(() => fixedPosition(anchorRect), [anchorRect]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const onPointerDown = (event) => {
      if (!event.target.closest?.("[data-color-picker-popover]")) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose, open]);

  const commit = (nextRgb) => {
    const nextHex = formatHex(nextRgb);
    palettesApi?.addRecent?.(nextHex);
    onChange?.(nextHex);
  };

  const handleTabInputKeyDown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const inputs = Array.from(event.currentTarget.querySelectorAll("input"));
    const index = inputs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    inputs[(index + direction + inputs.length) % inputs.length]?.focus();
  };

  const tabFields = {
    RGB: [
      ["Red", rgb.r, 0, 255, next => commit({ ...rgb, r: clamp(next, 0, 255) })],
      ["Green", rgb.g, 0, 255, next => commit({ ...rgb, g: clamp(next, 0, 255) })],
      ["Blue", rgb.b, 0, 255, next => commit({ ...rgb, b: clamp(next, 0, 255) })],
    ],
    HSL: [
      ["HSL hue", Math.round(hsl.h), 0, 359, next => commit(hslToRgb(next, hsl.s, hsl.l))],
      ["HSL saturation", Math.round(hsl.s * 100), 0, 100, next => commit(hslToRgb(hsl.h, clamp(next, 0, 100) / 100, hsl.l))],
      ["HSL lightness", Math.round(hsl.l * 100), 0, 100, next => commit(hslToRgb(hsl.h, hsl.s, clamp(next, 0, 100) / 100))],
    ],
    HSV: [
      ["HSV hue", Math.round(hsv.h), 0, 359, next => commit(hsvToRgb(next, hsv.s, hsv.v))],
      ["HSV saturation", Math.round(hsv.s * 100), 0, 100, next => commit(hsvToRgb(hsv.h, clamp(next, 0, 100) / 100, hsv.v))],
      ["HSV value", Math.round(hsv.v * 100), 0, 100, next => commit(hsvToRgb(hsv.h, hsv.s, clamp(next, 0, 100) / 100))],
    ],
  };

  if (!open) return null;

  return (
    <div
      data-color-picker-popover
      className="pf-color-picker-popover"
      role="dialog"
      aria-label="Color picker"
      style={style}
    >
      <div className="pf-color-picker-tabs" role="tablist" aria-label="Color format">
        {TABS.map(name => (
          <button
            key={name}
            className={`pf-chip-btn ${tab === name ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="pf-color-picker-body">
        <div
          className="pf-color-picker-sv"
          aria-label="Saturation value gradient"
          role="slider"
          tabIndex={0}
          style={{
            background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${formatHex(hsvToRgb(hsv.h, 1, 1))})`,
          }}
          onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            const v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
            commit(hsvToRgb(hsv.h, s, v));
          }}
        />
        <label className="pf-color-picker-field">
          <span>Hue</span>
          <input
            className="pf-slider pf-color-picker-hue"
            type="range"
            min={0}
            max={359}
            value={Math.round(hsv.h)}
            aria-label="Hue"
            onChange={event => commit(hsvToRgb(Number(event.target.value), hsv.s, hsv.v))}
          />
        </label>

        <div className="pf-color-picker-tab-body" onKeyDown={handleTabInputKeyDown}>
          {tab === "HEX" ? (
            <label className="pf-color-picker-field">
              <span>HEX</span>
              <input
                className="pf-input"
                value={hex}
                spellCheck={false}
                aria-label="HEX value"
                onChange={event => {
                  const parsed = parseHex(event.target.value);
                  if (parsed) commit(parsed);
                }}
              />
            </label>
          ) : (
            <div className="pf-mini-grid">
              {tabFields[tab].map(field => numberInput(...field))}
            </div>
          )}
        </div>

        {((palettesApi?.recents?.length || 0) > 0 || (palettesApi?.palettes?.length || 0) > 0) && (
          <div className="pf-color-picker-palettes">
            {!!palettesApi?.recents?.length && (
              <div className="pf-recent-row">
                {palettesApi.recents.map(color => (
                  <button
                    key={color}
                    className="pf-chip-btn swatch"
                    style={{ color }}
                    type="button"
                    aria-label={`Recent ${color}`}
                    onClick={() => commit(parseHex(color))}
                  />
                ))}
              </div>
            )}
            {palettesApi?.palettes?.map(palette => (
              <div className="pf-color-picker-palette" key={palette.id}>
                <div className="pf-field-help">{palette.name}</div>
                <div className="pf-recent-row">
                  {palette.colors.map(color => (
                    <button
                      key={`${palette.id}-${color}`}
                      className="pf-chip-btn swatch"
                      style={{ color }}
                      type="button"
                      aria-label={`${palette.name} ${color}`}
                      onClick={() => commit(parseHex(color))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pf-color-picker-save">
          <input
            className="pf-input"
            value={paletteName}
            onChange={event => setPaletteName(event.target.value)}
            aria-label="Palette name"
          />
          <button
            className="pf-chip-btn"
            type="button"
            onClick={() => palettesApi?.savePalette?.(paletteName, [hex])}
          >
            Save Palette
          </button>
        </div>
      </div>
    </div>
  );
}
