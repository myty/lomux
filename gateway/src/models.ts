/**
 * Default model alias map: friendly/legacy name → Copilot API model ID.
 *
 * User overrides in ModmuxConfig.modelMap are merged over this at runtime;
 * user entries win. Unknown names pass through unchanged.
 */
export const DEFAULT_MODEL_MAP: Record<string, string> = {
  // Anthropic aliases
  "claude-opus-4-6": "claude-opus-4-6",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-opus-4-5": "claude-opus-4-5",
  "claude-sonnet-4-5": "claude-sonnet-4-5",
  "claude-haiku-4-5": "claude-haiku-4-5",
  // Dated Anthropic model variants — map to their base model ID
  "claude-haiku-4-5-20251001": "claude-haiku-4-5",
  "claude-3-5-sonnet": "claude-3.5-sonnet",
  "claude-3-opus": "claude-3-opus",
  "claude-3-haiku": "claude-3-haiku",
  // OpenAI aliases
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4-turbo": "gpt-4-turbo",
  "gpt-4": "gpt-4",
  "gpt-3.5-turbo": "gpt-3.5-turbo",
  // GPT-5/Codex aliases — only for models NOT in Copilot's live list.
  // Maps to the most capable chat-compatible model available.
  // Models in the live list (gpt-5.3-codex, gpt-5.2-codex, gpt-5.2,
  // gpt-5-mini, gpt-5.4, gpt-5.4-mini) are resolved via exact-match.
  "gpt-5.1-codex": "gpt-41-copilot",
  "gpt-5.1-codex-mini": "gpt-4o-mini",
  "gpt-5.1-codex-max": "gpt-41-copilot",
  "gpt-5.1": "gpt-41-copilot",
  // Codex defaults
  "codex-mini-latest": "gpt-4o-mini",
  // Generic aliases
  "default": "gpt-41-copilot",
};

/**
 * Resolve a requested model name to the Copilot model ID.
 *
 * Resolution order:
 * 1. userOverrides (from ModmuxConfig.modelMap)
 * 2. DEFAULT_MODEL_MAP
 * 3. Pass through unchanged (Copilot may accept the raw name)
 */
export function resolveModel(
  requested: string,
  userOverrides: Record<string, string> = {},
): string {
  const merged: Record<string, string> = {
    ...DEFAULT_MODEL_MAP,
    ...userOverrides,
  };
  return merged[requested] ?? requested;
}
