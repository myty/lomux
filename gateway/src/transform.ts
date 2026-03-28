import type { ProxyResponse, StreamEvent } from "./types.ts";

export function toProxyResponse(
  content: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): ProxyResponse {
  return {
    id: `msg_coco_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: content }],
    model,
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

export function toStreamEvent(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
