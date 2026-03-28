import { DEFAULT_MODEL_MAP } from "./models.ts";
import { fetchModelList } from "../../providers/src/models.ts";
import { jsonResponse } from "./response-utils.ts";
import type { OpenAIModel, OpenAIModelList } from "./types.ts";

export async function handleModels(): Promise<Response> {
  const created = Math.floor(Date.now() / 1000);
  const liveModels = await fetchModelList().catch(() => []);

  const advertisedModelIds = [
    ...liveModels,
    ...Object.keys(DEFAULT_MODEL_MAP),
    ...Object.values(DEFAULT_MODEL_MAP),
  ];

  const models: OpenAIModel[] = advertisedModelIds
    .filter((value, index, values) => values.indexOf(value) === index)
    .map((id) => ({
      id,
      object: "model" as const,
      created,
      owned_by: "github-copilot",
    }));

  const list: OpenAIModelList = { object: "list", data: models };
  return jsonResponse(list);
}
