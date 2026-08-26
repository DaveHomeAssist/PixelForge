import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiConfig, setApiConfig, clearApiConfig, hasAnthropicKey, hasProviderKey } from "../ai/storage.js";
import { refinePrompt } from "../ai/claude.js";

describe("ai/storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("round-trips api config in the dedicated namespace", () => {
    setApiConfig({ anthropicKey: "sk-ant-test", providerId: "replicate", providerKey: "r8_test" });
    const cfg = getApiConfig();
    expect(cfg.anthropicKey).toBe("sk-ant-test");
    expect(cfg.providerId).toBe("replicate");
    expect(cfg.providerKey).toBe("r8_test");
  });

  it("uses a namespace distinct from prefs and stays out of localStorage", () => {
    setApiConfig({ anthropicKey: "sk-ant-isolated" });
    // Prefs namespace must not leak
    const prefsRaw = window.localStorage.getItem("PixelForge.prefs.v1");
    if (prefsRaw) expect(prefsRaw).not.toContain("sk-ant-isolated");
    const aiRaw = window.sessionStorage.getItem("PixelForge.ai.v1");
    expect(aiRaw).toContain("sk-ant-isolated");
    // Keys are session-scoped: localStorage is origin-wide on GitHub Pages.
    expect(window.localStorage.getItem("PixelForge.ai.v1")).toBeNull();
  });

  it("migrates a legacy localStorage config into sessionStorage and removes it", () => {
    window.localStorage.setItem("PixelForge.ai.v1", JSON.stringify({ anthropicKey: "sk-ant-legacy" }));
    const cfg = getApiConfig();
    expect(cfg.anthropicKey).toBe("sk-ant-legacy");
    expect(window.localStorage.getItem("PixelForge.ai.v1")).toBeNull();
    expect(window.sessionStorage.getItem("PixelForge.ai.v1")).toContain("sk-ant-legacy");
  });

  it("clearApiConfig wipes the namespace", () => {
    setApiConfig({ anthropicKey: "sk-ant-x" });
    clearApiConfig();
    expect(getApiConfig()).toEqual({});
  });

  it("hasAnthropicKey and hasProviderKey reflect stored values", () => {
    expect(hasAnthropicKey()).toBe(false);
    expect(hasProviderKey()).toBe(false);
    setApiConfig({ anthropicKey: "k" });
    expect(hasAnthropicKey()).toBe(true);
    expect(hasProviderKey()).toBe(false);
    setApiConfig({ providerKey: "p" });
    expect(hasProviderKey()).toBe(true);
  });
});

describe("ai/claude.refinePrompt", () => {
  it("throws when the API key is missing", async () => {
    await expect(refinePrompt("dragon", "", { sdk: {} })).rejects.toThrow(/Anthropic API key/);
  });

  it("throws when the prompt is empty", async () => {
    await expect(refinePrompt("   ", "k", { sdk: {} })).rejects.toThrow(/Empty prompt/);
  });

  it("sends cache_control on the system prompt and returns structured output", async () => {
    const createSpy = vi.fn().mockResolvedValue({
      content: [{
        type: "tool_use",
        name: "refined_prompt",
        input: { prompt: "refined dragon", negative_prompt: "blurry", suggested_aspect_ratio: "16:9" },
      }],
    });
    const ctorSpy = vi.fn();
    class AnthropicStub {
      constructor(opts) {
        ctorSpy(opts);
        this.messages = { create: createSpy };
      }
    }
    const sdk = { Anthropic: AnthropicStub };
    const out = await refinePrompt("a dragon", "sk-ant-k", { sdk });
    expect(out.prompt).toBe("refined dragon");
    expect(out.aspect).toBe("16:9");
    expect(out.negativePrompt).toBe("blurry");
    expect(createSpy).toHaveBeenCalledTimes(1);
    const body = createSpy.mock.calls[0][0];
    const sys = Array.isArray(body.system) ? body.system[0] : null;
    expect(sys?.cache_control?.type).toBe("ephemeral");
    expect(body.tool_choice).toEqual({ type: "tool", name: "refined_prompt" });
    expect(ctorSpy).toHaveBeenCalledWith({ apiKey: "sk-ant-k", dangerouslyAllowBrowser: true });
  });

  it("throws if no tool block is returned", async () => {
    class AnthropicStub {
      constructor() {
        this.messages = { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "no tool" }] }) };
      }
    }
    const sdk = { Anthropic: AnthropicStub };
    await expect(refinePrompt("hello", "k", { sdk })).rejects.toThrow(/refined prompt/);
  });
});

describe("ai/providers/replicate CORS handling", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("maps opaque network/CORS TypeErrors to an actionable message", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { generate } = await import("../ai/providers/replicate.js");
    await expect(generate({ prompt: "p", apiKey: "r8_k" })).rejects.toThrow(/CORS proxy URL in AI Settings/);
  });

  it("routes requests through a configured proxy base URL", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ urls: { get: "https://api.replicate.com/v1/predictions/abc" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "succeeded", output: ["https://replicate.delivery/img.png"] }),
      })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["img"]) });
    const { generate } = await import("../ai/providers/replicate.js");
    await generate({ prompt: "p", apiKey: "r8_k", apiBase: "https://proxy.example.dev/" });
    expect(globalThis.fetch.mock.calls[0][0]).toBe("https://proxy.example.dev/v1/predictions");
    expect(globalThis.fetch.mock.calls[1][0]).toBe("https://proxy.example.dev/v1/predictions/abc");
    // Output download goes to the delivery CDN untouched.
    expect(globalThis.fetch.mock.calls[2][0]).toBe("https://replicate.delivery/img.png");
  });
});

describe("ai key isolation from project serialization", () => {
  afterEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
  it("does not include API keys in serialized project payload", async () => {
    const { createDefaultDocument, buildProjectPayload } = await import("../serialization.js");
    setApiConfig({ anthropicKey: "sk-ant-SECRET", providerKey: "r8_SECRET" });
    const { doc, activeId } = createDefaultDocument(32, 32);
    const payload = buildProjectPayload(doc, 32, 32, activeId, null);
    const str = JSON.stringify(payload);
    expect(str).not.toContain("sk-ant-SECRET");
    expect(str).not.toContain("r8_SECRET");
    expect(str).not.toContain("anthropicKey");
    expect(str).not.toContain("providerKey");
  });
});
