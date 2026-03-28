import { loadConfig } from "./store.ts";
import { log } from "./log.ts";
import {
  type ModelEndpoint,
  resolveModelForEndpoint,
} from "./model-resolver.ts";
import { isNonEmptyString, isRecord, readJsonBody } from "./request-utils.ts";
import { openAIErrorResponse } from "./response-utils.ts";

export async function parseOpenAIRequestBody(
  req: Request,
): Promise<Record<string, unknown> | Response> {
  const body = await readJsonBody(req);
  if (body === null) {
    return openAIErrorResponse(
      400,
      "Invalid JSON body",
      "invalid_request_error",
      "invalid_value",
    );
  }

  if (!isRecord(body)) {
    return openAIErrorResponse(
      400,
      "Request body is required",
      "invalid_request_error",
      "invalid_value",
    );
  }

  return body;
}

export function validateOpenAIModelField(
  body: Record<string, unknown>,
): Response | null {
  if (!isNonEmptyString(body.model)) {
    return openAIErrorResponse(
      400,
      "model is required",
      "invalid_request_error",
      "invalid_value",
    );
  }

  return null;
}

export async function resolveOpenAIModel(
  requestedModel: string,
  endpoint: ModelEndpoint,
  requestPath: string,
): Promise<string | Response> {
  const config = await loadConfig().catch(() => null);
  const modelResolution = await resolveModelForEndpoint(
    requestedModel,
    endpoint,
    config?.modelMap ?? {},
    config?.modelMappingPolicy,
  );

  if (modelResolution.rejected) {
    return openAIErrorResponse(
      400,
      modelResolution.rejectReason ??
        `Model "${requestedModel}" is not supported for ${requestPath} in strict mode`,
      "invalid_request_error",
      "invalid_value",
    );
  }

  if (modelResolution.resolvedModel !== requestedModel) {
    await log("debug", "Model resolved", {
      endpoint: requestPath,
      requestedModel,
      resolvedModel: modelResolution.resolvedModel,
      strategy: modelResolution.strategy,
    });
  }

  return modelResolution.resolvedModel;
}

export function openAIServiceUnavailable(err: unknown): Response {
  return openAIErrorResponse(
    503,
    err instanceof Error ? err.message : "Service unavailable",
    "api_error",
    "service_unavailable",
  );
}
