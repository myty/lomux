import { assertEquals } from "@std/assert";
import { resolveModel } from "../../src/agents/models.ts";

// T020: Model translation (alias resolution) contract tests

Deno.test("model translation — claude-3-5-sonnet maps to claude-3.5-sonnet", () => {
  assertEquals(resolveModel("claude-3-5-sonnet"), "claude-3.5-sonnet");
});

Deno.test("model translation — gpt-4o passes through unchanged", () => {
  assertEquals(resolveModel("gpt-4o"), "gpt-4o");
});

Deno.test("model translation — default maps to gpt-4o", () => {
  assertEquals(resolveModel("default"), "gpt-4o");
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
