import { assertEquals } from "@std/assert";
import { resolveModel } from "@modmux/gateway";

// T020: Model translation (alias resolution) contract tests

Deno.test("model translation — claude-3-5-sonnet maps to claude-3.5-sonnet", () => {
  assertEquals(resolveModel("claude-3-5-sonnet"), "claude-3.5-sonnet");
});

Deno.test("model translation — gpt-4o passes through unchanged", () => {
  assertEquals(resolveModel("gpt-4o"), "gpt-4o");
});

Deno.test("model translation — default maps to gpt-41-copilot", () => {
  assertEquals(resolveModel("default"), "gpt-41-copilot");
});

Deno.test("model translation — codex-mini-latest maps to gpt-4o-mini", () => {
  assertEquals(resolveModel("codex-mini-latest"), "gpt-4o-mini");
});

Deno.test("model translation — gpt-5.4 passes through unchanged (Copilot supports it natively)", () => {
  assertEquals(resolveModel("gpt-5.4"), "gpt-5.4");
});

Deno.test("model translation — unknown model passes through unchanged", () => {
  assertEquals(resolveModel("unknown-model-xyz"), "unknown-model-xyz");
});

Deno.test("model translation — user override wins", () => {
  assertEquals(
    resolveModel("gpt-4o", { "gpt-4o": "custom-model" }),
    "custom-model",
  );
});

Deno.test("model translation — user can introduce new alias", () => {
  assertEquals(
    resolveModel("my-alias", { "my-alias": "target-model" }),
    "target-model",
  );
});
