const SYSTEM_PROMPT = `You refine user prompts for image generation. Given a short, casual prompt, produce:
1) A detailed positive prompt with subject, composition, lighting, art style hints.
2) A concise negative prompt listing undesirable artifacts.
3) A suggested aspect ratio from: "1:1", "3:2", "2:3", "16:9".

Return output exclusively via the refined_prompt tool.`;

const REFINE_TOOL = {
  name: "refined_prompt",
  description: "Return a refined image-generation prompt.",
  input_schema: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Refined positive prompt" },
      negative_prompt: { type: "string", description: "Terms to avoid" },
      suggested_aspect_ratio: { type: "string", enum: ["1:1", "3:2", "2:3", "16:9"] },
    },
    required: ["prompt"],
  },
};

export async function refinePrompt(rawPrompt, apiKey, { signal, sdk } = {}) {
  if (!apiKey) throw new Error("Missing Anthropic API key");
  if (!rawPrompt || !rawPrompt.trim()) throw new Error("Empty prompt");

  // The SDK is injected at call time so tests can swap it without touching
  // the live package. In production, the caller passes the real Anthropic SDK.
  if (!sdk) throw new Error("Anthropic SDK not provided");

  const client = new sdk.Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [REFINE_TOOL],
    tool_choice: { type: "tool", name: "refined_prompt" },
    messages: [{ role: "user", content: rawPrompt }],
  }, signal ? { signal } : undefined);

  const toolBlock = response.content?.find(b => b.type === "tool_use" && b.name === "refined_prompt");
  if (!toolBlock) throw new Error("Claude did not return a refined prompt");
  const input = toolBlock.input || {};
  return {
    prompt: input.prompt || rawPrompt,
    negativePrompt: input.negative_prompt || "",
    aspect: input.suggested_aspect_ratio || "1:1",
  };
}
