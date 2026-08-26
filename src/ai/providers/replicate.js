// Replicate adapter — thin wrapper around the predictions API.
// Callers supply their own API key. This uses fetch() directly to avoid
// pulling in the Replicate SDK (keeps bundle small).

const DEFAULT_API_BASE = "https://api.replicate.com";
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 120; // ~3 min max

// SDXL by default. Flux Schnell would be ~stability-ai/sdxl otherwise.
const DEFAULT_MODEL_VERSION = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

// api.replicate.com does not send CORS headers, so a browser page cannot call
// it directly — the preflight fails before the request is sent. Users route
// requests through their own CORS proxy (e.g. a small Cloudflare Worker that
// forwards to api.replicate.com) configured in AI Settings.
const CORS_HELP =
  "Could not reach Replicate. Browsers cannot call api.replicate.com directly " +
  "(its CORS policy blocks web pages). Set a CORS proxy URL in AI Settings " +
  "that forwards requests to api.replicate.com.";

function normalizeApiBase(apiBase) {
  const base = typeof apiBase === "string" ? apiBase.trim().replace(/\/+$/, "") : "";
  return base || DEFAULT_API_BASE;
}

function rebaseUrl(url, apiBase) {
  const base = normalizeApiBase(apiBase);
  if (base === DEFAULT_API_BASE) return url;
  return url.startsWith(DEFAULT_API_BASE) ? base + url.slice(DEFAULT_API_BASE.length) : url;
}

async function apiFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    // fetch() rejects network/CORS failures with an opaque TypeError; abort
    // signals reject with a DOMException and pass through untouched.
    if (err instanceof TypeError) throw new Error(CORS_HELP, { cause: err });
    throw err;
  }
}

async function createPrediction(apiKey, body, signal, apiBase) {
  const res = await apiFetch(`${normalizeApiBase(apiBase)}/v1/predictions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate prediction failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function pollPrediction(url, apiKey, signal, onProgress, apiBase) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const res = await apiFetch(rebaseUrl(url, apiBase), {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal,
    });
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);
    const json = await res.json();
    if (onProgress) onProgress(json.status, attempt / MAX_POLL_ATTEMPTS);
    if (json.status === "succeeded") return json;
    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(`Replicate ${json.status}: ${json.error || "unknown"}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Replicate generation timed out");
}

async function fetchBlob(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to download generated image: ${res.status}`);
  return res.blob();
}

function aspectToDims(aspect) {
  switch (aspect) {
    case "3:2": return { width: 1024, height: 682 };
    case "2:3": return { width: 682, height: 1024 };
    case "16:9": return { width: 1024, height: 576 };
    case "1:1":
    default: return { width: 1024, height: 1024 };
  }
}

export async function generate({ prompt, negativePrompt, aspect = "1:1", apiKey, apiBase, signal, onProgress }) {
  const { width, height } = aspectToDims(aspect);
  const prediction = await createPrediction(apiKey, {
    version: DEFAULT_MODEL_VERSION.split(":")[1],
    input: {
      prompt,
      negative_prompt: negativePrompt || "",
      width,
      height,
      num_outputs: 1,
    },
  }, signal, apiBase);
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error("Replicate did not return a poll URL");
  const finished = await pollPrediction(pollUrl, apiKey, signal, onProgress, apiBase);
  const outputUrl = Array.isArray(finished.output) ? finished.output[0] : finished.output;
  if (!outputUrl) throw new Error("Replicate returned no output");
  return fetchBlob(outputUrl, signal);
}

export async function inpaint({ prompt, baseImage, maskImage, apiKey, apiBase, signal, onProgress }) {
  // SDXL inpainting model. Input expects data-URL base64 strings.
  const baseUrl = await blobToDataUrl(baseImage);
  const maskUrl = await blobToDataUrl(maskImage);
  const prediction = await createPrediction(apiKey, {
    version: DEFAULT_MODEL_VERSION.split(":")[1],
    input: {
      prompt,
      image: baseUrl,
      mask: maskUrl,
      num_outputs: 1,
    },
  }, signal, apiBase);
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error("Replicate did not return a poll URL");
  const finished = await pollPrediction(pollUrl, apiKey, signal, onProgress, apiBase);
  const outputUrl = Array.isArray(finished.output) ? finished.output[0] : finished.output;
  if (!outputUrl) throw new Error("Replicate returned no output");
  return fetchBlob(outputUrl, signal);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export const id = "replicate";
export const label = "Replicate (SDXL)";
