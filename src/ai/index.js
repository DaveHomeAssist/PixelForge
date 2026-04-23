import { refinePrompt } from "./claude.js";
import { getProvider, DEFAULT_PROVIDER_ID } from "./providers/index.js";
import { getApiConfig } from "./storage.js";

let cachedSdk = null;
async function loadAnthropicSdk() {
  if (cachedSdk) return cachedSdk;
  // Dynamic import so the SDK is not in the critical bundle — only loaded if
  // the user actually uses AI features.
  const mod = await import(/* @vite-ignore */ "@anthropic-ai/sdk");
  cachedSdk = mod.default ? { Anthropic: mod.default } : { Anthropic: mod.Anthropic };
  return cachedSdk;
}

export async function generateLayer(rawPrompt, { aspect = "1:1", signal, onProgress, sdkOverride, providerOverride } = {}) {
  const config = getApiConfig();
  if (!config.anthropicKey) throw new Error("Set your Anthropic API key in AI settings.");
  if (!config.providerKey) throw new Error("Set your image-provider API key in AI settings.");
  const sdk = sdkOverride || await loadAnthropicSdk();
  const refined = await refinePrompt(rawPrompt, config.anthropicKey, { signal, sdk });
  const provider = providerOverride || getProvider(config.providerId || DEFAULT_PROVIDER_ID);
  const blob = await provider.generate({
    prompt: refined.prompt,
    negativePrompt: refined.negativePrompt,
    aspect: refined.aspect || aspect,
    apiKey: config.providerKey,
    signal,
    onProgress,
  });
  return { blob, refined };
}

export async function generateInpaint(rawPrompt, baseImage, maskImage, { signal, onProgress, sdkOverride, providerOverride } = {}) {
  const config = getApiConfig();
  if (!config.anthropicKey) throw new Error("Set your Anthropic API key in AI settings.");
  if (!config.providerKey) throw new Error("Set your image-provider API key in AI settings.");
  const sdk = sdkOverride || await loadAnthropicSdk();
  const refined = await refinePrompt(rawPrompt, config.anthropicKey, { signal, sdk });
  const provider = providerOverride || getProvider(config.providerId || DEFAULT_PROVIDER_ID);
  const blob = await provider.inpaint({
    prompt: refined.prompt,
    negativePrompt: refined.negativePrompt,
    baseImage,
    maskImage,
    apiKey: config.providerKey,
    signal,
    onProgress,
  });
  return { blob, refined };
}

export { refinePrompt };
export * from "./storage.js";
