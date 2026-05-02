import { applyWorkerImageEffect } from "../imageEffectsCore.js";

const cancelled = new Set();

export async function runImageEffectsWorkerJob(message) {
  const { id, imageData, effect, amount } = message || {};
  if (cancelled.has(id)) {
    cancelled.delete(id);
    return { id, cancelled: true };
  }
  const nextImageData = applyWorkerImageEffect(imageData, effect, amount);
  if (cancelled.has(id)) {
    cancelled.delete(id);
    return { id, cancelled: true };
  }
  return { id, imageData: nextImageData };
}

export async function handleImageEffectsWorkerMessage(message) {
  if (message?.type === "cancel") {
    cancelled.add(message.id);
    return { id: message.id, cancelled: true };
  }
  if (message?.type !== "run") return null;
  try {
    return await runImageEffectsWorkerJob(message);
  } catch (err) {
    return { id: message.id, error: err?.message || "Image effect worker failed" };
  }
}

if (typeof self !== "undefined" && typeof document === "undefined" && typeof self.postMessage === "function") {
  self.addEventListener("message", async (event) => {
    const result = await handleImageEffectsWorkerMessage(event.data);
    if (!result || event.data?.type === "cancel") return;
    self.postMessage(result);
  });
}
