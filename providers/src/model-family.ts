export type ModelFamily = "claude" | "openai" | "unknown";

export function modelFamily(model: string): ModelFamily {
  const lower = model.toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (
    lower.includes("codex") || lower.startsWith("gpt") ||
    /^o[134]\b/.test(lower)
  ) {
    return "openai";
  }
  return "unknown";
}

export function isCodexLike(model: string): boolean {
  return model.toLowerCase().includes("codex");
}

export function subfamilyRank(
  requestedModel: string,
  candidateModel: string,
): number {
  const requested = requestedModel.toLowerCase();
  const candidate = candidateModel.toLowerCase();

  if (requested.includes("sonnet")) return candidate.includes("sonnet") ? 2 : 0;
  if (requested.includes("opus")) return candidate.includes("opus") ? 2 : 0;
  if (requested.includes("haiku")) return candidate.includes("haiku") ? 2 : 0;
  if (requested.includes("codex")) return candidate.includes("codex") ? 2 : 0;
  if (requested.includes("gpt-4o")) return candidate.includes("gpt-4o") ? 2 : 0;
  if (
    requested.includes("gpt-4.1") || requested.includes("gpt-41")
  ) {
    return candidate.includes("gpt-4.1") || candidate.includes("gpt-41")
      ? 2
      : 0;
  }
  if (requested.includes("gpt-5")) return candidate.includes("gpt-5") ? 2 : 0;

  return 0;
}
