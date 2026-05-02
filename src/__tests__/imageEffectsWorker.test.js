import { afterEach, describe, expect, it, vi } from "vitest";
import { applyImageEffect, applyImageEffectAsync, resetImageEffectsWorkerForTests } from "../imageEffects.js";
import { runImageEffectsWorkerJob } from "../workers/imageEffectsWorker.js";

function image(width, height, pixels) {
  return new ImageData(new Uint8ClampedArray(pixels), width, height);
}

function fixture4x4() {
  return image(4, 4, [
    12, 34, 56, 255, 90, 120, 160, 255, 210, 64, 32, 255, 8, 200, 120, 255,
    255, 240, 200, 255, 64, 16, 180, 255, 128, 128, 128, 255, 20, 60, 240, 255,
    180, 40, 90, 255, 32, 220, 240, 255, 240, 200, 40, 255, 70, 80, 90, 255,
    0, 0, 0, 255, 255, 255, 255, 255, 44, 88, 132, 255, 160, 24, 220, 255,
  ]);
}

function hashImageData(img) {
  let hash = 2166136261;
  for (const byte of img.data) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function largeImageData() {
  const pixels = new Uint8ClampedArray(300 * 300 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 20;
    pixels[i + 1] = 80;
    pixels[i + 2] = 160;
    pixels[i + 3] = 255;
  }
  return new ImageData(pixels, 300, 300);
}

describe("imageEffectsWorker", () => {
  const originalWorker = globalThis.Worker;
  const originalWindowWorker = window.Worker;

  afterEach(() => {
    resetImageEffectsWorkerForTests();
    globalThis.Worker = originalWorker;
    window.Worker = originalWindowWorker;
  });

  it("matches main-thread output for hue on a 4x4 fixture", async () => {
    const source = fixture4x4();
    const worker = await runImageEffectsWorkerJob({ id: 1, type: "run", imageData: source, effect: "hue", amount: 45 });
    const main = applyImageEffect(source, "hue", 45);

    expect(hashImageData(worker.imageData)).toBe(hashImageData(main));
  });

  it("aborts async worker results before commit handlers run", async () => {
    class FakeWorker {
      constructor() {
        this.listeners = {};
        this.cancelled = new Set();
      }

      addEventListener(type, listener) {
        this.listeners[type] = listener;
      }

      postMessage(message) {
        if (message.type === "cancel") {
          this.cancelled.add(message.id);
          return;
        }
        window.setTimeout(() => {
          if (this.cancelled.has(message.id)) return;
          runImageEffectsWorkerJob(message).then(result => {
            this.listeners.message?.({ data: result });
          });
        }, 20);
      }

      terminate() {}
    }
    globalThis.Worker = FakeWorker;
    window.Worker = FakeWorker;
    const onCommit = vi.fn();
    const controller = new AbortController();
    const promise = applyImageEffectAsync(largeImageData(), "hue", 30, { signal: controller.signal })
      .then(onCommit)
      .catch(() => {});

    controller.abort();
    await promise;
    await new Promise(resolve => window.setTimeout(resolve, 30));

    expect(onCommit).not.toHaveBeenCalled();
  });
});
