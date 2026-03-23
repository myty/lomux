import { openAIError } from "./openai-translate.ts";
import type { ErrorResponse } from "./types.ts";

export const EVENT_STREAM_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no", // Disable nginx buffering
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  // Additional anti-buffering headers for various proxies
  "Proxy-Buffering": "off",
  "Fastcgi-Buffering": "off",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(
  status: number,
  type: string,
  message: string,
  param: string | null,
): Response {
  const body: ErrorResponse = {
    type: "error",
    error: { type, message, param },
  };
  return jsonResponse(body, status);
}

export function openAIErrorBody(
  message: string,
  type: string,
  code: string,
): Record<string, unknown> {
  return openAIError(message, type, code);
}

export function openAIErrorResponse(
  status: number,
  message: string,
  type: string,
  code: string,
): Response {
  return jsonResponse(openAIErrorBody(message, type, code), status);
}
