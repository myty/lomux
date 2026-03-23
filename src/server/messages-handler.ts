import { chat, chatStream, countTokens } from "./copilot.ts";
import {
  isNonEmptyArray,
  isNonEmptyString,
  isRecord,
  readJsonBody,
} from "./request-utils.ts";
import {
  errorResponse,
  EVENT_STREAM_HEADERS,
  jsonResponse,
} from "./response-utils.ts";
import { toStreamEvent } from "./transform.ts";
import type { Message, ProxyRequest } from "./types.ts";
import { validateRequest } from "./types.ts";
import { loadConfig } from "../config/store.ts";

export async function handleMessages(req: Request): Promise<Response> {
  const body = await readJsonBody(req);
  if (body === null) {
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
    const config = await loadConfig();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let backpressureCount = 0;
        let isClosed = false;

        const queueChunk = async (data: string): Promise<void> => {
          if (isClosed) return;

          try {
            controller.enqueue(encoder.encode(data));
          } catch (err) {
            if (err instanceof TypeError && err.message.includes('full')) {
              backpressureCount++;
              // Implement exponential backoff for backpressure
              const delay = Math.min(100 * backpressureCount, 1000);
              await new Promise(resolve => setTimeout(resolve, delay));

              if (!isClosed) {
                // Retry the enqueue
                controller.enqueue(encoder.encode(data));
              }
            } else if (err instanceof TypeError && err.message.includes('close')) {
              // Stream is already closed, ignore
              isClosed = true;
            } else {
              throw err;
            }
          }
        };

        try {
          await chatStream(request, async (event) => {
            await queueChunk(toStreamEvent(event));
          });
        } catch (err) {
          if (!isClosed) {
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
            await queueChunk(
              `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`,
            );
          }
        } finally {
          if (!isClosed) {
            isClosed = true;
            controller.close();
          }
        }
      },
    }, {
      highWaterMark: config.streaming.highWaterMark,
    });

    return new Response(stream, {
      status: 200,
      headers: EVENT_STREAM_HEADERS,
    });
  }

  try {
    const response = await chat(request);
    return jsonResponse(response);
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

export async function handleCountTokens(req: Request): Promise<Response> {
  const body = await readJsonBody(req);
  if (body === null) {
    return errorResponse(
      400,
      "invalid_request_error",
      "Invalid JSON body",
      null,
    );
  }

  if (!isRecord(body)) {
    return errorResponse(
      400,
      "invalid_request_error",
      "Request body is required",
      null,
    );
  }

  if (!isNonEmptyString(body.model)) {
    return errorResponse(
      400,
      "invalid_request_error",
      "model is required",
      "model",
    );
  }

  if (!isNonEmptyArray<Message>(body.messages)) {
    return errorResponse(
      400,
      "invalid_request_error",
      "messages is required",
      "messages",
    );
  }

  try {
    const response = countTokens({
      model: body.model,
      messages: body.messages,
    });
    return jsonResponse(response);
  } catch (err) {
    return errorResponse(
      503,
      "service_error",
      err instanceof Error ? err.message : "Copilot unavailable",
      null,
    );
  }
}
