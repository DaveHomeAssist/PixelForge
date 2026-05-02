import { applyImageEffect } from "./imageEffectsCore.js";

export {
  applyImageEffect,
  convolveImageData,
  blurImageData,
  sharpenImageData,
  motionBlurImageData,
  findConnectedBounds,
  findConnectedSelection,
} from "./imageEffectsCore.js";

const WORKER_EFFECTS = new Set(["hue", "saturation", "lightness", "gaussianBlur", "motionBlur", "sharpen"]);
const WORKER_PIXEL_THRESHOLD = 256 * 256;
let imageEffectsWorker = null;
let workerRequestId = 1;
const workerRequests = new Map();

function abortError() {
  if (typeof DOMException === "function") return new DOMException("Image effect aborted", "AbortError");
  const error = new Error("Image effect aborted");
  error.name = "AbortError";
  return error;
}

function getImageEffectsWorker() {
  if (typeof globalThis.Worker !== "function") return null;
  if (imageEffectsWorker) return imageEffectsWorker;
  imageEffectsWorker = new Worker(new URL("./workers/imageEffectsWorker.js", import.meta.url), { type: "module" });
  imageEffectsWorker.addEventListener("message", (event) => {
    const { id, imageData, error, cancelled } = event.data || {};
    const request = workerRequests.get(id);
    if (!request) return;
    workerRequests.delete(id);
    request.cleanup();
    if (cancelled) {
      request.reject(abortError());
      return;
    }
    if (error) {
      request.reject(new Error(error));
      return;
    }
    request.resolve(imageData);
  });
  imageEffectsWorker.addEventListener("error", (event) => {
    const error = new Error(event.message || "Image effect worker failed");
    workerRequests.forEach(request => {
      request.cleanup();
      request.reject(error);
    });
    workerRequests.clear();
    imageEffectsWorker?.terminate?.();
    imageEffectsWorker = null;
  });
  return imageEffectsWorker;
}

export function resetImageEffectsWorkerForTests() {
  imageEffectsWorker?.terminate?.();
  imageEffectsWorker = null;
  workerRequests.clear();
}

function runImageEffectOnWorker(imageData, effect, amount, options = {}) {
  const worker = getImageEffectsWorker();
  if (!worker) return Promise.resolve(applyImageEffect(imageData, effect, amount, options));
  if (options.signal?.aborted) return Promise.reject(abortError());
  const id = workerRequestId;
  workerRequestId += 1;

  return new Promise((resolve, reject) => {
    const abort = () => {
      worker.postMessage({ id, type: "cancel" });
      const request = workerRequests.get(id);
      if (!request) return;
      workerRequests.delete(id);
      request.cleanup();
      reject(abortError());
    };
    const cleanup = () => options.signal?.removeEventListener?.("abort", abort);
    workerRequests.set(id, { resolve, reject, cleanup });
    options.signal?.addEventListener?.("abort", abort, { once: true });
    worker.postMessage({ id, type: "run", imageData, effect, amount });
  });
}

export function applyImageEffectAsync(imageData, effect, amount = 0, options = {}) {
  const pixelCount = (imageData?.width || 0) * (imageData?.height || 0);
  const shouldUseWorker = WORKER_EFFECTS.has(effect) &&
    pixelCount > WORKER_PIXEL_THRESHOLD &&
    typeof options.rng !== "function";
  if (!shouldUseWorker) {
    if (options.signal?.aborted) return Promise.reject(abortError());
    return Promise.resolve(applyImageEffect(imageData, effect, amount, options));
  }
  return runImageEffectOnWorker(imageData, effect, amount, options);
}
