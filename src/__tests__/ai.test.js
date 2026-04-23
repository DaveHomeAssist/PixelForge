import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiConfig, setApiConfig, clearApiConfig, hasAnthropicKey, hasProviderKey } from "../ai/storage.js";
import { refinePrompt } from "../ai/claude.js";

describe("ai/storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips api config in the dedicated namespace", () => {
    setApiConfig({ anthropicKey: "sk-ant-test", providerId: "replicate", providerKey: "r8_test" });
    const cfg = getApiConfig();
    expect(cfg.anthropicKey).toBe("sk-ant-test");
    expect(cfg.providerId).toBe("replicate");
    expect(cfg.providerKey).toBe("r8_test");
  });

  it("uses a namespace distinct from prefs", () => {
    setApiConfig({ anthropicKey: "sk-ant-isolated" });
    // Prefs namespace must not leak
    const prefsRaw = window.localStorage.getItem("PixelForge.prefs.v1");
    if (prefsRaw) expect(prefsRaw).not.toContain("sk-ant-isolated");
    const aiRaw = window.localStorage.getItem("PixelForge.ai.v1");
    expect(aiRaw).toContain("sk-ant-isolated");
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

describe("ai key isolation from project serialization", () => {
  afterEach(() => { window.localStorage.clear(); });
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
