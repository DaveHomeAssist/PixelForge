import "fake-indexeddb/auto";
import "vitest-canvas-mock";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  });
}

// --- localStorage mock -------------------------------------------------------
// jsdom provides one, but in this environment window.localStorage.clear is
// missing (likely because of the `--localstorage-file` warning preventing the
// real store from initializing). Provide a simple in-memory shim.
(() => {
  const store = new Map();
  const ls = {
    get length() { return store.size; },
    key(i) { return Array.from(store.keys())[i] ?? null; },
    getItem(k) { return store.has(String(k)) ? store.get(String(k)) : null; },
    setItem(k, v) { store.set(String(k), String(v)); },
    removeItem(k) { store.delete(String(k)); },
    clear() { store.clear(); },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: ls,
  });
  if (typeof globalThis !== "undefined") {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value: ls,
    });
  }
})();

// --- Canvas 2D shim ----------------------------------------------------------
// vitest-canvas-mock provides stubs that return zeros for getImageData and a
// bogus toDataURL, which breaks (a) the background-color test and (b) the
// round-trip serialization test (Image.onload never fires). Replace with a
// minimal pixel-buffer-backed implementation good enough for unit tests.
const __originalProtoDrawImage = CanvasRenderingContext2D.prototype.drawImage;
(() => {
  function parseColor(input) {
    if (!input) return [0, 0, 0, 255];
    if (Array.isArray(input)) return input;
    const s = String(input).trim();
    if (s.startsWith("#")) {
      const hex = s.slice(1);
      const full = hex.length === 3
        ? hex.split("").map((c) => c + c).join("")
        : hex.padEnd(6, "0");
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      const a = full.length >= 8 ? parseInt(full.slice(6, 8), 16) : 255;
      return [r, g, b, a];
    }
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
      return [
        parts[0] | 0,
        parts[1] | 0,
        parts[2] | 0,
        parts.length >= 4 ? Math.round(parts[3] * 255) : 255,
      ];
    }
    return [0, 0, 0, 255];
  }

  function makeContext(canvas) {
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    const data = new Uint8ClampedArray(w * h * 4);
    const ctx = {
      canvas,
      fillStyle: "#000000",
      strokeStyle: "#000000",
      lineWidth: 1,
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      imageSmoothingEnabled: false,
      fillRect(x, y, rw, rh) {
        const [r, g, b, a] = parseColor(this.fillStyle);
        const x0 = Math.max(0, x | 0);
        const y0 = Math.max(0, y | 0);
        const x1 = Math.min(w, (x + rw) | 0);
        const y1 = Math.min(h, (y + rh) | 0);
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const i = (yy * w + xx) * 4;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = a;
          }
        }
      },
      clearRect(x, y, rw, rh) {
        const x0 = Math.max(0, x | 0);
        const y0 = Math.max(0, y | 0);
        const x1 = Math.min(w, (x + rw) | 0);
        const y1 = Math.min(h, (y + rh) | 0);
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const i = (yy * w + xx) * 4;
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0;
          }
        }
      },
      strokeRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      rect() {},
      arc() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      rotate() {},
      setTransform() {},
      resetTransform() {},
      drawImage(...args) {
        // If a test has monkey-patched CanvasRenderingContext2D.prototype.drawImage
        // (e.g. with a spy), forward to it so assertions on the spy work. The
        // original vitest-canvas-mock drawImage validates its argument in ways
        // incompatible with our lightweight mocks, so only forward when the
        // prototype method has been swapped out.
        const proto = CanvasRenderingContext2D.prototype.drawImage;
        if (proto && proto !== __originalProtoDrawImage) {
          try { proto.apply(this, args); } catch { /* ignore */ }
        }
      },
      getImageData(sx, sy, sw, sh) {
        const out = new Uint8ClampedArray(sw * sh * 4);
        for (let yy = 0; yy < sh; yy++) {
          for (let xx = 0; xx < sw; xx++) {
            const srcX = sx + xx;
            const srcY = sy + yy;
            const dstI = (yy * sw + xx) * 4;
            if (srcX < 0 || srcY < 0 || srcX >= w || srcY >= h) continue;
            const srcI = (srcY * w + srcX) * 4;
            out[dstI] = data[srcI];
            out[dstI + 1] = data[srcI + 1];
            out[dstI + 2] = data[srcI + 2];
            out[dstI + 3] = data[srcI + 3];
          }
        }
        return new ImageData(out, sw, sh);
      },
      putImageData(img, dx, dy) {
        const iw = img.width;
        const ih = img.height;
        for (let yy = 0; yy < ih; yy++) {
          for (let xx = 0; xx < iw; xx++) {
            const dstX = dx + xx;
            const dstY = dy + yy;
            if (dstX < 0 || dstY < 0 || dstX >= w || dstY >= h) continue;
            const srcI = (yy * iw + xx) * 4;
            const dstI = (dstY * w + dstX) * 4;
            data[dstI] = img.data[srcI];
            data[dstI + 1] = img.data[srcI + 1];
            data[dstI + 2] = img.data[srcI + 2];
            data[dstI + 3] = img.data[srcI + 3];
          }
        }
      },
      createImageData(sw, sh) {
        return new ImageData(sw, sh);
      },
      measureText() { return { width: 0 }; },
      fillText() {},
      strokeText() {},
      clip() {},
      quadraticCurveTo() {},
      bezierCurveTo() {},
      ellipse() {},
      arcTo() {},
    };
    return ctx;
  }

  const ctxCache = new WeakMap();
  HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type !== "2d") return null;
    let ctx = ctxCache.get(this);
    if (!ctx) {
      ctx = makeContext(this);
      ctxCache.set(this, ctx);
    }
    return ctx;
  };
  HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
    return "data:image/png;base64,AAAA";
  };
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb) {
    cb(new Blob([new Uint8Array([0])], { type: "image/png" }));
  };
})();

// --- Image mock --------------------------------------------------------------
// jsdom's Image never fires load events for data: URLs, which causes the
// serialization round-trip test to hang. Install a mock that fires onload
// asynchronously whenever src is assigned.
(() => {
  class MockImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this._src = "";
      this.width = 0;
      this.height = 0;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
    }
    get src() { return this._src; }
    set src(value) {
      this._src = value;
      queueMicrotask(() => { try { this.onload?.(); } catch { /* ignore */ } });
    }
  }
  window.Image = MockImage;
  globalThis.Image = MockImage;
})();
