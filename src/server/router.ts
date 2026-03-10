import {
  type ErrorResponse,
  type Message,
  type OpenAIChatRequest,
  type OpenAIModel,
  type OpenAIModelList,
  type ProxyRequest,
  validateRequest,
} from "./types.ts";
import { chat, chatStream, countTokens } from "./copilot.ts";
import { toStreamEvent } from "./transform.ts";
import { addShutdownHandler, getConfig } from "./server.ts";
import { log } from "../lib/log.ts";
import {
  anthropicStreamEventToOpenAI,
  anthropicToOpenAI,
  makeStreamState,
  openAIError,
  openAIToAnthropic,
} from "./openai-translate.ts";
import { DEFAULT_MODEL_MAP, resolveModel } from "../agents/models.ts";
import { loadConfig } from "../config/store.ts";

const server = Deno.serve;

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST" && url.pathname === "/v1/messages") {
    return await handleMessages(req);
  }

  if (req.method === "POST" && url.pathname === "/v1/messages/count_tokens") {
    return await handleCountTokens(req);
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    return await handleChatCompletions(req);
  }

  if (req.method === "GET" && url.pathname === "/v1/models") {
    return handleModels();
  }

  return new Response(
    JSON.stringify({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "Not found",
        param: null,
      },
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleMessages(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch (error: unknown) {
    console.error("Request Handled:", error, req);
    return errorResponse(
      400,
      "invalid_request_error",
      "Invalid JSON body",
      null,
    );
  }

  const validation = validateRequest(body);
  if (!validation.valid) {
    return errorResponse(
      400,
      validation.error!.error.type,
      validation.error!.error.message,
      validation.error!.error.param,
    );
  }

  const request = body as ProxyRequest;

  if (request.stream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await chatStream(request, (event) => {
            controller.enqueue(encoder.encode(toStreamEvent(event)));
          });
        } catch (err) {
          const errorEvent = {
            type: "error" as const,
            error: {
              type: "service_error",
              message: err instanceof Error
                ? err.message
                : "Internal server error",
              param: null,
            },
          };
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  try {
    const response = await chat(request);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Request Chat Error:", "400", err);
    return errorResponse(
      503,
      "service_error",
      err instanceof Error ? err.message : "Copilot unavailable",
      null,
    );
  }
}

async function handleCountTokens(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      400,
      "invalid_request_error",
      "Invalid JSON body",
      null,
    );
  }

  if (!body || typeof body !== "object") {
    return errorResponse(
      400,
      "invalid_request_error",
      "Request body is required",
      null,
    );
  }

  const r = body as Record<string, unknown>;
  if (typeof r.model !== "string" || r.model === "") {
    return errorResponse(
      400,
      "invalid_request_error",
      "model is required",
      "model",
    );
  }
  if (!Array.isArray(r.messages) || r.messages.length === 0) {
    return errorResponse(
      400,
      "invalid_request_error",
      "messages is required",
      "messages",
    );
  }

  try {
    const response = countTokens({
      model: r.model as string,
      messages: r.messages as Message[],
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return errorResponse(
      503,
      "service_error",
      err instanceof Error ? err.message : "Copilot unavailable",
      null,
    );
  }
}

function openAIErrorResponse(
  status: number,
  message: string,
  type: string,
  code: string,
): Response {
  return new Response(JSON.stringify(openAIError(message, type, code)), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleChatCompletions(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return openAIErrorResponse(
      400,
      "Invalid JSON body",
      "invalid_request_error",
      "invalid_value",
    );
  }

  if (!body || typeof body !== "object") {
    return openAIErrorResponse(
      400,
      "Request body is required",
      "invalid_request_error",
      "invalid_value",
    );
  }

  const r = body as Record<string, unknown>;
  if (typeof r.model !== "string" || !r.model) {
    return openAIErrorResponse(
      400,
      "model is required",
      "invalid_request_error",
      "invalid_value",
    );
  }
  if (!Array.isArray(r.messages) || r.messages.length === 0) {
    return openAIErrorResponse(
      400,
      "messages is required and must be non-empty",
      "invalid_request_error",
      "invalid_value",
    );
  }

  const openAIReq = body as OpenAIChatRequest;
  const config = await loadConfig().catch(() => null);
  const resolvedModel = resolveModel(openAIReq.model, config?.modelMap ?? {});
  const anthropicReq: ProxyRequest = {
    ...openAIToAnthropic(openAIReq),
    model: resolvedModel,
  };

  if (anthropicReq.stream) {
    const state = makeStreamState(resolvedModel);
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await chatStream(anthropicReq, (event) => {
            const line = anthropicStreamEventToOpenAI(event, state);
            if (line) controller.enqueue(encoder.encode(line));
          });
          // Ensure [DONE] is always emitted
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          const errBody = openAIError(
            err instanceof Error ? err.message : "Service unavailable",
            "api_error",
            "service_unavailable",
          );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errBody)}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  try {
    const anthropicResp = await chat(anthropicReq);
    const openAIResp = anthropicToOpenAI(anthropicResp, resolvedModel);
    return new Response(JSON.stringify(openAIResp), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return openAIErrorResponse(
      503,
      err instanceof Error ? err.message : "Service unavailable",
      "api_error",
      "service_unavailable",
    );
  }
}

function handleModels(): Response {
  const created = Math.floor(Date.now() / 1000);
  const models: OpenAIModel[] = Object.values(DEFAULT_MODEL_MAP)
    .filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate
    .map((id) => ({
      id,
      object: "model" as const,
      created,
      owned_by: "github-copilot",
    }));

  const list: OpenAIModelList = { object: "list", data: models };
  return new Response(JSON.stringify(list), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(
  status: number,
  type: string,
  message: string,
  param: string | null,
): Response {
  const body: ErrorResponse = {
    type: "error",
    error: { type, message, param },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function startServer(): Promise<
  { port: number; stop: () => Promise<void> }
> {
  const config = await getConfig();
  addShutdownHandler();

  const httpServer = server({
    hostname: config.hostname,
    port: config.port,
    handler: handleRequest,
    onListen: ({ port, hostname }) => {
      log("info", "Server started", { port, hostname });
    },
  });

  const { port } = httpServer.addr as Deno.NetAddr;

  return {
    port,
    stop: () => httpServer.shutdown(),
  };
}
