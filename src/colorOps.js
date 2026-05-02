export function rgbToHsl(r, g, b) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === nr) h = (ng - nb) / d + (ng < nb ? 6 : 0);
  else if (max === ng) h = (nb - nr) / d + 2;
  else h = (nr - ng) / d + 4;

  return { h: h * 60, s, l };
}

export function hslToRgb(h, s, l) {
  const hue = (((Number(h) || 0) % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(1, Number(s) || 0));
  const light = Math.max(0, Math.min(1, Number(l) || 0));

  if (sat === 0) {
    const value = Math.round(light * 255);
    return { r: value, g: value, b: value };
  }

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let rr = 0;
  let gg = 0;
  let bb = 0;

  if (hue < 60) [rr, gg, bb] = [c, x, 0];
  else if (hue < 120) [rr, gg, bb] = [x, c, 0];
  else if (hue < 180) [rr, gg, bb] = [0, c, x];
  else if (hue < 240) [rr, gg, bb] = [0, x, c];
  else if (hue < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];

  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
}

export function adjustRgbHsl(r, g, b, hueDelta = 0, saturationScale = 1, lightnessDelta = 0) {
  // TODO Phase 6.5.x: worker-offload HSL adjustments when 1024² buffers exceed the 50ms target.
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === nr) h = (ng - nb) / d + (ng < nb ? 6 : 0);
    else if (max === ng) h = (nb - nr) / d + 2;
    else h = (nr - ng) / d + 4;
    h *= 60;
  }

  h = (((h + hueDelta) % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s * saturationScale));
  l = Math.max(0, Math.min(1, l + lightnessDelta));

  if (s === 0) {
    const value = Math.round(l * 255);
    return (value << 16) | (value << 8) | value;
  }

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0;
  let gg = 0;
  let bb = 0;

  if (h < 60) {
    rr = c;
    gg = x;
  } else if (h < 120) {
    rr = x;
    gg = c;
  } else if (h < 180) {
    gg = c;
    bb = x;
  } else if (h < 240) {
    gg = x;
    bb = c;
  } else if (h < 300) {
    rr = x;
    bb = c;
  } else {
    rr = c;
    bb = x;
  }

  return (Math.round((rr + m) * 255) << 16)
    | (Math.round((gg + m) * 255) << 8)
    | Math.round((bb + m) * 255);
}
