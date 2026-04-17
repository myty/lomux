import { DEFAULT_MODEL_MAP, resolveModel as resolveAlias } from "./models.ts";
import { fetchModelList } from "../../providers/src/models.ts";

export type ModelEndpoint = "chat_completions" | "responses";
export type ModelMappingPolicy = "compatible" | "strict";

export interface ModelResolution {
  requestedModel: string;
  resolvedModel: string;
  strategy: string;
  rejected?: boolean;
  rejectReason?: string;
}

const CACHE_TTL_MS = 60_000;

let cachedAvailableModels: string[] = [];
let cacheExpiresAt = 0;

const CHAT_COMPAT_FALLBACKS: string[] = [
  "gpt-41-copilot",
  "gpt-4.1-2025-04-14",
  "gpt-4.1",
  "gpt-4o-2024-11-20",
  "gpt-4o",
  "gpt-4o-mini-2024-07-18",
  "gpt-4o-mini",
  "gpt-4-turbo",
];

/**
 * Models known to work only with chat/completions, not with /v1/responses.
 * Copilot-specific model IDs fall into this category.
 */
const CHAT_ONLY_MODELS = new Set(["gpt-41-copilot"]);

/**
 * Ordered fallback list for the /v1/responses endpoint.
 * Uses standard OpenAI model IDs that the responses endpoint accepts.
 */
const RESPONSES_COMPAT_FALLBACKS: string[] = [
  "gpt-4.1",
  "gpt-4.1-2025-04-14",
  "gpt-4o",
  "gpt-4o-mini",
];

function uniq(values: string[]): string[] {
  return values.filter((v, i, arr) => arr.indexOf(v) === i);
}

async function getAvailableModels(): Promise<string[]> {
  if (Date.now() < cacheExpiresAt && cachedAvailableModels.length > 0) {
    return cachedAvailableModels;
  }

  const live = await fetchModelList().catch(() => []);
  cachedAvailableModels = uniq([
    ...live,
    ...Object.values(DEFAULT_MODEL_MAP),
  ]);
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedAvailableModels;
}

function isLikelyUnsupportedByChatCompletions(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes("codex") || lower.startsWith("gpt-5");
}

function familyCandidates(
  requestedModel: string,
  endpoint: ModelEndpoint,
): string[] {
  const lower = requestedModel.toLowerCase();
  const fallbacks = endpoint === "responses"
    ? RESPONSES_COMPAT_FALLBACKS
    : CHAT_COMPAT_FALLBACKS;

  if (lower.startsWith("gpt-5") || lower.includes("codex")) {
    return fallbacks;
  }
  if (lower.startsWith("gpt-4.1") || lower.startsWith("gpt-41")) {
    return endpoint === "responses"
      ? ["gpt-4.1", "gpt-4.1-2025-04-14", "gpt-4o"]
      : ["gpt-41-copilot", "gpt-4.1-2025-04-14", "gpt-4.1", "gpt-4o"];
  }
  if (lower.startsWith("gpt-4o")) {
    return ["gpt-4o-2024-11-20", "gpt-4o", "gpt-4o-mini"];
  }

  return fallbacks;
}

function pickFirstAvailable(
  candidates: string[],
  available: Set<string>,
): string | null {
  for (const candidate of candidates) {
    if (available.has(candidate)) return candidate;
  }
  return null;
}

export async function resolveModelForEndpoint(
  requestedModel: string,
  endpoint: ModelEndpoint,
  userOverrides: Record<string, string> = {},
  policy: ModelMappingPolicy = "compatible",
): Promise<ModelResolution> {
  const availableList = await getAvailableModels();
  const available = new Set(availableList);

  const aliasResolved = resolveAlias(requestedModel, userOverrides);
  const normalizedDashed = requestedModel.replaceAll(".", "-");
  const directCandidates = uniq([
    requestedModel,
    aliasResolved,
    normalizedDashed,
  ]);

  const usesChatCompletionsBackend = endpoint === "chat_completions";

  if (policy === "strict") {
    const canUseExact = available.has(requestedModel) &&
      (!usesChatCompletionsBackend ||
        !isLikelyUnsupportedByChatCompletions(requestedModel));

    if (canUseExact) {
      return {
        requestedModel,
        resolvedModel: requestedModel,
        strategy: "exact",
      };
    }

    return {
      requestedModel,
      resolvedModel: requestedModel,
      strategy: "strict-reject",
      rejected: true,
      rejectReason:
        `Model "${requestedModel}" is not endpoint-compatible without remapping`,
    };
  }

  // For the responses endpoint, a model that appears directly in the live
  // Copilot list should be used as-is — aliases were designed for
  // chat/completions and may point to chat-only model IDs.
  if (endpoint === "responses" && available.has(requestedModel)) {
    return {
      requestedModel,
      resolvedModel: requestedModel,
      strategy: "exact",
    };
  }

  // If there's an explicit alias (user override or DEFAULT_MODEL_MAP), honour it —
  // unless we're on the responses endpoint and the alias resolves to a model
  // known to be chat/completions-only.
  if (aliasResolved !== requestedModel) {
    const aliasUsable = endpoint !== "responses" ||
      !CHAT_ONLY_MODELS.has(aliasResolved);

    if (aliasUsable) {
      const aliasTarget = available.has(aliasResolved)
        ? aliasResolved
        : pickFirstAvailable(
          familyCandidates(requestedModel, endpoint),
          available,
        ) ??
          aliasResolved;
      return {
        requestedModel,
        resolvedModel: aliasTarget,
        strategy: aliasTarget === aliasResolved
          ? "alias-or-normalized"
          : "family-fallback",
      };
    }

    // Alias is chat-only; fall through to responses-compatible fallback.
  }

  // No alias (or alias skipped) — if the exact model is available use it.
  if (available.has(requestedModel)) {
    return {
      requestedModel,
      resolvedModel: requestedModel,
      strategy: "exact",
    };
  }

  // For chat/completions, avoid known unsupported families.
  if (usesChatCompletionsBackend) {
    if (!isLikelyUnsupportedByChatCompletions(requestedModel)) {
      const direct = pickFirstAvailable(directCandidates, available);
      if (direct) {
        return {
          requestedModel,
          resolvedModel: direct,
          strategy: direct === requestedModel ? "exact" : "alias-or-normalized",
        };
      }
    }
  } else {
    const direct = pickFirstAvailable(directCandidates, available);
    if (direct) {
      return {
        requestedModel,
        resolvedModel: direct,
        strategy: direct === requestedModel ? "exact" : "alias-or-normalized",
      };
    }
  }

  const family = pickFirstAvailable(
    familyCandidates(requestedModel, endpoint),
    available,
  );
  if (family) {
    return {
      requestedModel,
      resolvedModel: family,
      strategy: "family-fallback",
    };
  }

  for (const id of availableList) {
    if (requestedModel.startsWith(id) || id.startsWith(requestedModel)) {
      return {
        requestedModel,
        resolvedModel: id,
        strategy: "prefix-fallback",
      };
    }
  }

  return {
    requestedModel,
    resolvedModel: requestedModel,
    strategy: "passthrough",
  };
}
