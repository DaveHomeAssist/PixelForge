function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyImageEffect(imageData, effect, amount = 0, options = {}) {
  if (effect === "blur" || effect === "gaussianBlur") return blurImageData(imageData);
  if (effect === "sharpen") return sharpenImageData(imageData);
  if (effect === "motionBlur") return motionBlurImageData(imageData, amount);
  if (effect === "hue") return adjustImageDataHsl(imageData, Number(amount) || 0, 1, 0, options.signal);
  if (effect === "saturation") return adjustImageDataHsl(imageData, 0, 1 + (Number(amount) || 0) / 100, 0, options.signal);
  if (effect === "lightness") return adjustImageDataHsl(imageData, 0, 1, (Number(amount) || 0) / 100, options.signal);

  const next = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const data = next.data;
  const amt = Number(amount) || 0;
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  for (let i = 0; i < data.length; i += 4) {
    if (options.signal?.aborted) break;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (effect === "brightness") {
      data[i] = clampByte(r + amt);
      data[i + 1] = clampByte(g + amt);
      data[i + 2] = clampByte(b + amt);
    } else if (effect === "contrast") {
      const factor = (259 * (amt + 255)) / (255 * (259 - amt));
      data[i] = clampByte(factor * (r - 128) + 128);
      data[i + 1] = clampByte(factor * (g - 128) + 128);
      data[i + 2] = clampByte(factor * (b - 128) + 128);
    } else if (effect === "invert") {
      data[i] = 255 - r;
      data[i + 1] = 255 - g;
      data[i + 2] = 255 - b;
    } else if (effect === "grayscale") {
      const y = clampByte(luminance(r, g, b));
      data[i] = y;
      data[i + 1] = y;
      data[i + 2] = y;
    } else if (effect === "threshold") {
      const y = luminance(r, g, b) >= (amt || 128) ? 255 : 0;
      data[i] = y;
      data[i + 1] = y;
      data[i + 2] = y;
    } else if (effect === "sepia") {
      data[i] = clampByte(r * 0.393 + g * 0.769 + b * 0.189);
      data[i + 1] = clampByte(r * 0.349 + g * 0.686 + b * 0.168);
      data[i + 2] = clampByte(r * 0.272 + g * 0.534 + b * 0.131);
    } else if (effect === "posterize") {
      const levels = Math.max(2, Math.min(16, amt || 4));
      const step = 255 / (levels - 1);
      data[i] = clampByte(Math.round(r / step) * step);
      data[i + 1] = clampByte(Math.round(g / step) * step);
      data[i + 2] = clampByte(Math.round(b / step) * step);
    } else if (effect === "noise") {
      const strength = Math.max(0, Math.min(255, Math.abs(amt)));
      const delta = (rng() * 2 - 1) * strength;
      data[i] = clampByte(r + delta);
      data[i + 1] = clampByte(g + delta);
      data[i + 2] = clampByte(b + delta);
    } else if (effect === "hue-sat") {
      const gray = luminance(r, g, b);
      const sat = 1 + amt / 100;
      data[i] = clampByte(gray + (r - gray) * sat);
      data[i + 1] = clampByte(gray + (g - gray) * sat);
      data[i + 2] = clampByte(gray + (b - gray) * sat);
    }
  }
  return next;
}

export function applyWorkerImageEffect(imageData, effect, amount = 0, options = {}) {
  if (effect === "blur" || effect === "gaussianBlur") return blurImageData(imageData);
  if (effect === "sharpen") return sharpenImageData(imageData);
  if (effect === "motionBlur") return motionBlurImageData(imageData, amount);
  if (effect === "hue") return adjustImageDataHsl(imageData, Number(amount) || 0, 1, 0, options.signal);
  if (effect === "saturation") return adjustImageDataHsl(imageData, 0, 1 + (Number(amount) || 0) / 100, 0, options.signal);
  if (effect === "lightness") return adjustImageDataHsl(imageData, 0, 1, (Number(amount) || 0) / 100, options.signal);
  throw new Error(`Unsupported worker image effect: ${effect}`);
}

function adjustImageDataHsl(imageData, hueDelta = 0, saturationScale = 1, lightnessDelta = 0, signal) {
  const next = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const data = next.data;
  for (let i = 0; i < data.length; i += 4) {
    if (signal?.aborted) break;
    const nr = data[i] / 255;
    const ng = data[i + 1] / 255;
    const nb = data[i + 2] / 255;
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
    s *= saturationScale;
    if (s < 0) s = 0;
    else if (s > 1) s = 1;
    l += lightnessDelta;
    if (l < 0) l = 0;
    else if (l > 1) l = 1;

    if (s === 0) {
      const value = Math.round(l * 255);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      continue;
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

    data[i] = Math.round((rr + m) * 255);
    data[i + 1] = Math.round((gg + m) * 255);
    data[i + 2] = Math.round((bb + m) * 255);
  }
  return next;
}

export function convolveImageData(imageData, kernel, divisor = 1, bias = 0) {
  const { width, height } = imageData;
  const source = imageData.data;
  const next = new ImageData(new Uint8ClampedArray(source), width, height);
  const target = next.data;
  const size = Math.sqrt(kernel.length);
  const radius = Math.floor(size / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      let rr = 0, gg = 0, bb = 0;
      for (let ky = -radius; ky <= radius; ky += 1) {
        for (let kx = -radius; kx <= radius; kx += 1) {
          const sx = Math.max(0, Math.min(width - 1, x + kx));
          const sy = Math.max(0, Math.min(height - 1, y + ky));
          const src = (sy * width + sx) * 4;
          const kval = kernel[(ky + radius) * size + (kx + radius)];
          rr += source[src] * kval;
          gg += source[src + 1] * kval;
          bb += source[src + 2] * kval;
        }
      }
      target[out] = clampByte(rr / divisor + bias);
      target[out + 1] = clampByte(gg / divisor + bias);
      target[out + 2] = clampByte(bb / divisor + bias);
    }
  }
  return next;
}

export function blurImageData(imageData) {
  // Phase 6.5.2: worker offload landed for buffers >256²; main-thread fallback retained for small previews and abort recovery.
  return convolveImageData(imageData, [1, 2, 1, 2, 4, 2, 1, 2, 1], 16);
}

export function sharpenImageData(imageData) {
  return convolveImageData(imageData, [0, -1, 0, -1, 5, -1, 0, -1, 0], 1);
}

export function motionBlurImageData(imageData, amount = 8) {
  const { width, height } = imageData;
  const source = imageData.data;
  const next = new ImageData(new Uint8ClampedArray(source), width, height);
  const target = next.data;
  const radius = Math.max(1, Math.min(64, Math.round(Math.abs(Number(amount) || 8))));
  const size = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    let rr = 0;
    let gg = 0;
    let bb = 0;
    let aa = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const x = Math.max(0, Math.min(width - 1, k));
      const idx = (y * width + x) * 4;
      rr += source[idx];
      gg += source[idx + 1];
      bb += source[idx + 2];
      aa += source[idx + 3];
    }

    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      target[out] = clampByte(rr / size);
      target[out + 1] = clampByte(gg / size);
      target[out + 2] = clampByte(bb / size);
      target[out + 3] = clampByte(aa / size);

      const removeX = Math.max(0, Math.min(width - 1, x - radius));
      const addX = Math.max(0, Math.min(width - 1, x + radius + 1));
      const removeIdx = (y * width + removeX) * 4;
      const addIdx = (y * width + addX) * 4;
      rr += source[addIdx] - source[removeIdx];
      gg += source[addIdx + 1] - source[removeIdx + 1];
      bb += source[addIdx + 2] - source[removeIdx + 2];
      aa += source[addIdx + 3] - source[removeIdx + 3];
    }
  }

  return next;
}

export function findConnectedBounds(imageData, startX, startY, tolerance = 16) {
  return findConnectedSelection(imageData, startX, startY, tolerance)?.rect || null;
}

export function findConnectedSelection(imageData, startX, startY, tolerance = 16) {
  const { width, height, data } = imageData;
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return null;
  const idx = (y0 * width + x0) * 4;
  const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  const seen = new Uint8Array(width * height);
  const stack = [[x0, y0]];
  let left = x0, right = x0, top = y0, bottom = y0;
  const tol = Math.max(0, Math.min(255, tolerance));
  const matches = (x, y) => {
    const i = (y * width + x) * 4;
    return Math.abs(data[i] - target[0]) <= tol
      && Math.abs(data[i + 1] - target[1]) <= tol
      && Math.abs(data[i + 2] - target[2]) <= tol
      && Math.abs(data[i + 3] - target[3]) <= tol;
  };
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const key = y * width + x;
    if (seen[key] || !matches(x, y)) continue;
    seen[key] = 1;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const rect = { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  const mask = { w: rect.w, h: rect.h, data: new Uint8Array(rect.w * rect.h) };
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (seen[y * width + x]) mask.data[(y - top) * rect.w + (x - left)] = 1;
    }
  }
  return { rect, mask };
}
