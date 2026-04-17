import { assertEquals, assertStringIncludes } from "@std/assert";
import { summarizeLogText } from "@modmux/gateway";

Deno.test("summarizeLogText preserves short text", () => {
  assertEquals(summarizeLogText("plain error"), "plain error");
});

Deno.test("summarizeLogText trims surrounding whitespace", () => {
  assertEquals(summarizeLogText("  plain error  "), "plain error");
});

Deno.test("summarizeLogText truncates oversized text with marker", () => {
  const longText = "x".repeat(600);
  const summary = summarizeLogText(longText);

  assertEquals(summary.length, 514);
  assertStringIncludes(summary, "...[truncated]");
});
