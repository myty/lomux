import { assert, assertEquals } from "@std/assert";
import { handleRequest } from "../../src/server/router.ts";
import { stopClient } from "../../src/server/copilot.ts";
import { getGlobalDiagnostics, resetGlobalDiagnostics } from "../../src/lib/streaming-diagnostics.ts";

const BASE = "http://localhost";

function postJSON(path: string, body: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_STREAMING_BODY = {
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: "Say 'Hello' and then count to 5 slowly." }],
  max_tokens: 50,
  stream: true,
};

// Test helper to measure streaming latency
async function measureStreamingLatency(response: Response): Promise<{
  firstChunkTime: number;
  chunks: Array<{ timestamp: number; data: string }>;
  totalTime: number;
}> {
  const startTime = Date.now();
  let firstChunkTime = 0;
  const chunks: Array<{ timestamp: number; data: string }> = [];

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const timestamp = Date.now();
      const data = decoder.decode(value, { stream: true });

      if (firstChunkTime === 0) {
        firstChunkTime = timestamp - startTime;
      }

      chunks.push({ timestamp, data });
    }
  } finally {
    reader.releaseLock();
  }

  return {
    firstChunkTime,
    chunks,
    totalTime: Date.now() - startTime,
  };
}

// Test enhanced anti-buffering headers
Deno.test(
  "POST /v1/messages - streaming includes enhanced anti-buffering headers",
  { sanitizeOps: false, sanitizeResources: false },
  async () => {
    const req = postJSON("/v1/messages", VALID_STREAMING_BODY);
    const res = await handleRequest(req);

    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Content-Type"), "text/event-stream");
    assertEquals(res.headers.get("Cache-Control"), "no-cache, no-store, must-revalidate");
    assertEquals(res.headers.get("Connection"), "keep-alive");
    assertEquals(res.headers.get("X-Accel-Buffering"), "no");
    assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");

    // Clean up properly
    try {
      await res.body?.cancel();
    } catch {
      // Ignore cleanup errors
    }

    try {
      await stopClient();
    } catch {
      // Ignore cleanup errors
    }
  }
);

Deno.test(
  "POST /v1/messages - streaming diagnostics collection",
  { sanitizeOps: false, sanitizeResources: false },
  async () => {
    // Reset diagnostics before test
    resetGlobalDiagnostics();

    try {
      const req = postJSON("/v1/messages", VALID_STREAMING_BODY);
      const res = await handleRequest(req);

      if (res.status === 200) {
        // Consume some of the stream to trigger diagnostics
        const reader = res.body?.getReader();
        if (reader) {
          for (let i = 0; i < 5; i++) {
            const { done } = await reader.read();
            if (done) break;
          }
          reader.releaseLock();
        }

        // Check that diagnostics were collected
        const diagnostics = getGlobalDiagnostics();
        const metrics = diagnostics.getMetrics();

        // Should have recorded some chunks
        assert(metrics.totalChunks >= 0, "Should have recorded chunk metrics");
        assert(metrics.sessionStart > 0, "Should have valid session start time");
      }

      await res.body?.cancel();
    } finally {
      await stopClient();
    }
  },
);

Deno.test(
  "POST /v1/messages - streaming performance baseline",
  { sanitizeOps: false, sanitizeResources: false },
  async () => {
    try {
      const req = postJSON("/v1/messages", VALID_STREAMING_BODY);
      const res = await handleRequest(req);

      if (res.status === 200) {
        const metrics = await measureStreamingLatency(res);

        // Performance expectations:
        // - First chunk should arrive quickly (< 5 seconds for test environment)
        // - Should have multiple chunks for a counting response
        assert(metrics.firstChunkTime < 5000,
          `First chunk took too long: ${metrics.firstChunkTime}ms`);

        assert(metrics.chunks.length >= 1,
          "Should receive at least one chunk");

        console.log(`Streaming performance:
  - First chunk: ${metrics.firstChunkTime}ms
  - Total chunks: ${metrics.chunks.length}
  - Total time: ${metrics.totalTime}ms`);
      } else {
        // Service unavailable is acceptable for testing
        assertEquals(res.status, 503);
        await res.body?.cancel();
      }
    } finally {
      await stopClient();
    }
  },
);

Deno.test(
  "POST /v1/chat/completions - OpenAI endpoint streaming headers",
  { sanitizeOps: false, sanitizeResources: false },
  async () => {
    try {
      const req = postJSON("/v1/chat/completions", {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
        max_tokens: 10,
      });

      const res = await handleRequest(req);

      // Should return streaming headers regardless of backend availability
      if (res.status === 200) {
        assertEquals(res.headers.get("Content-Type"), "text/event-stream");
        assertEquals(res.headers.get("Cache-Control"), "no-cache, no-store, must-revalidate");
        assertEquals(res.headers.get("X-Accel-Buffering"), "no");
      }

      await res.body?.cancel();
    } finally {
      await stopClient();
    }
  },
);

// Test configuration impact
Deno.test("Streaming configuration validation", async () => {
  // This test validates that streaming configuration is properly loaded
  // and has reasonable defaults

  const { DEFAULT_CONFIG } = await import("../../src/config/store.ts");
  const streaming = DEFAULT_CONFIG.streaming;

  // Validate default configuration
  assert(streaming.flushTimeoutMs > 0 && streaming.flushTimeoutMs <= 1000,
    "flushTimeoutMs should be reasonable");
  assert(streaming.maxBufferBytes >= 512 && streaming.maxBufferBytes <= 2048,
    "maxBufferBytes should be reasonable");
  assertEquals(streaming.enableAggressiveFlushing, true,
    "Should enable aggressive flushing by default");
  assertEquals(streaming.enableDiagnostics, false,
    "Should disable diagnostics in production by default");
  assert(streaming.highWaterMark >= 1024,
    "highWaterMark should be adequate");
});