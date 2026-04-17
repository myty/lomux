import { assertEquals } from "@std/assert";
import { isCodexLike, modelFamily, subfamilyRank } from "@modmux/providers";

Deno.test("modelFamily classifies Claude models", () => {
  assertEquals(modelFamily("claude-sonnet-4-6"), "claude");
});

Deno.test("modelFamily classifies OpenAI and Codex models", () => {
  assertEquals(modelFamily("gpt-5.4"), "openai");
  assertEquals(modelFamily("gpt-5.3-codex"), "openai");
  assertEquals(modelFamily("o3"), "openai");
});

Deno.test("modelFamily classifies unknown models", () => {
  assertEquals(modelFamily("some-future-model"), "unknown");
});

Deno.test("isCodexLike detects codex models only", () => {
  assertEquals(isCodexLike("gpt-5.3-codex"), true);
  assertEquals(isCodexLike("gpt-5.4"), false);
});

Deno.test("subfamilyRank prefers matching Claude subfamilies", () => {
  assertEquals(subfamilyRank("claude-opus-4-6", "claude-opus-4-5"), 2);
  assertEquals(subfamilyRank("claude-opus-4-6", "claude-sonnet-4-6"), 0);
});

Deno.test("subfamilyRank prefers matching GPT subfamilies", () => {
  assertEquals(subfamilyRank("gpt-4o", "gpt-4o-mini"), 2);
  assertEquals(subfamilyRank("gpt-5.1", "gpt-5.4"), 2);
  assertEquals(subfamilyRank("gpt-5.1", "gpt-4o"), 0);
});
