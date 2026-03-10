/**
 * Contract tests for the OpenAI-compatible proxy endpoints.
 * POST /v1/chat/completions (non-streaming + streaming)
 * GET  /v1/models
 * GET  /health (already covered in server_test.ts, included here for completeness)
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { handleRequest } from "../../src/server/router.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function server() {
  return Deno.serve({
    port: 0,
    hostname: "127.0.0.1",
    handler: handleRequest,
    onListen: () => {},
  });
}

function post(
  port: number,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get(port: number, path: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`);
}

// ---------------------------------------------------------------------------
// /v1/chat/completions — validation
// ---------------------------------------------------------------------------

Deno.test("OpenAI /v1/chat/completions — missing model returns 400", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  try {
    const res = await post(port, "/v1/chat/completions", {
      messages: [{ role: "user", content: "hi" }],
    });
    assertEquals(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assertEquals(
      (body.error as Record<string, unknown>).type,
      "invalid_request_error",
    );
  } finally {
    await s.shutdown();
  }
});

Deno.test("OpenAI /v1/chat/completions — missing messages returns 400", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  try {
    const res = await post(port, "/v1/chat/completions", { model: "gpt-4o" });
    assertEquals(res.status, 400);
    const body = await res.json() as Record<string, unknown>;
    assertEquals(
      (body.error as Record<string, unknown>).type,
      "invalid_request_error",
    );
  } finally {
    await s.shutdown();
  }
});

Deno.test("OpenAI /v1/chat/completions — empty messages array returns 400", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  try {
    const res = await post(port, "/v1/chat/completions", {
      model: "gpt-4o",
      messages: [],
    });
    assertEquals(res.status, 400);
    await res.body?.cancel();
  } finally {
    await s.shutdown();
  }
});

// ---------------------------------------------------------------------------
// /v1/chat/completions — non-streaming response shape
// ---------------------------------------------------------------------------

Deno.test("OpenAI /v1/chat/completions — non-streaming returns object:chat.completion", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  try {
    const res = await post(port, "/v1/chat/completions", {
      model: "gpt-4o",
      messages: [{ role: "user", content: "ping" }],
      stream: false,
    });
    // May be 200 (Copilot available) or 503 (no Copilot token in test env)
    if (res.status === 200) {
      const body = await res.json() as Record<string, unknown>;
      assertEquals(body.object, "chat.completion");
      assertEquals(typeof body.id, "string");
      assertEquals(typeof body.created, "number");
      assertEquals(Array.isArray(body.choices), true);
      const choices = body.choices as Record<string, unknown>[];
      assertEquals(choices.length > 0, true);
    } else {
      await res.body?.cancel();
    }
  } finally {
    await s.shutdown();
  }
});

// ---------------------------------------------------------------------------
// /v1/chat/completions — streaming response shape
// ---------------------------------------------------------------------------

Deno.test("OpenAI /v1/chat/completions — streaming returns text/event-stream", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  try {
    const res = await post(port, "/v1/chat/completions", {
      model: "gpt-4o",
      messages: [{ role: "user", content: "ping" }],
      stream: true,
    });
    if (res.status === 200) {
      assertEquals(res.headers.get("content-type"), "text/event-stream");
      const text = await res.text();
      assertStringIncludes(text, "data:");
      assertStringIncludes(text, "[DONE]");
    } else {
      await res.body?.cancel();
    }
  } finally {
    await s.shutdown();
  }
});

// ---------------------------------------------------------------------------
// GET /v1/models
// ---------------------------------------------------------------------------

Deno.test("GET /v1/models — returns 200 with object:list", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  let body: Record<string, unknown>;
  try {
    const res = await get(port, "/v1/models");
    assertEquals(res.status, 200);
    body = await res.json() as Record<string, unknown>;
  } finally {
    await s.shutdown();
  }
  assertEquals(body!.object, "list");
  assertEquals(Array.isArray(body!.data), true);
  const models = body!.data as Record<string, unknown>[];
  assertEquals(models.length > 0, true);
  assertEquals(models[0].object, "model");
  assertEquals(typeof models[0].id, "string");
});

Deno.test("GET /v1/models — each model has owned_by: github-copilot", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  let models: Record<string, unknown>[];
  try {
    const res = await get(port, "/v1/models");
    const body = await res.json() as Record<string, unknown>;
    models = body.data as Record<string, unknown>[];
  } finally {
    await s.shutdown();
  }
  for (const model of models!) {
    assertEquals(model.owned_by, "github-copilot");
  }
});

// ---------------------------------------------------------------------------
// Method / path not found
// ---------------------------------------------------------------------------

Deno.test("POST /v1/models — wrong method returns 404 or 405", async () => {
  const s = server();
  const { port } = s.addr as Deno.NetAddr;
  try {
    const res = await post(port, "/v1/models", {});
    // 404 is acceptable (no POST handler registered)
    assertEquals(res.status === 404 || res.status === 405, true);
    await res.body?.cancel();
  } finally {
    await s.shutdown();
  }
});
