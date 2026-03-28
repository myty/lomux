/**
 * OpenAI-compatible types used by the Copilot HTTP client.
 * These are internal to src/copilot/ — the Anthropic-facing types remain in src/server/types.ts.
 */

// ---------------------------------------------------------------------------
// Version constants (shared by token.ts and client.ts)
// ---------------------------------------------------------------------------

export const VSCODE_VERSION = "1.104.3";
export const COPILOT_PLUGIN_VERSION = "0.26.7";
export const COPILOT_API_VERSION = "2025-04-01";

/** Default Copilot model used when the /models endpoint is unreachable. */
export const DEFAULT_COPILOT_MODEL = "claude-sonnet-4-6";

export interface CopilotToken {
  /** Bearer token value (e.g. "tid=abc123;...") */
  token: string;
  /** Expiry as milliseconds since epoch (parsed from expires_at ISO string) */
  expiresAt: number;
  /** Seconds until refresh is recommended (from refresh_in field) */
  refreshIn: number;
}

export interface OpenAIToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface OpenAITool {
  type: "function";
  function: OpenAIToolFunction;
}

export interface OpenAIToolCallFunction {
  name: string;
  arguments: string;
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: OpenAIToolCallFunction;
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | "required" | {
    type: "function";
    function: { name: string };
  };
  stream_options?: { include_usage?: boolean };
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: "stop" | "length" | "tool_calls" | null;
}

export interface OpenAIChatResponse {
  id: string;
  object: "chat.completion";
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIStreamToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface OpenAIStreamDelta {
  role?: "assistant";
  content?: string;
  tool_calls?: OpenAIStreamToolCallDelta[];
}

export interface OpenAIStreamChoice {
  index: number;
  delta: OpenAIStreamDelta;
  finish_reason: "stop" | "length" | "tool_calls" | null;
}

export interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  choices: OpenAIStreamChoice[];
  usage?: OpenAIUsage;
}

/**
 * Maps OpenAI finish_reason to Anthropic stop_reason.
 * "stop" → "end_turn", "length" → "max_tokens", "tool_calls" → "tool_use", null → null
 */
export function finishReasonToStopReason(
  r: string | null,
): "end_turn" | "max_tokens" | "tool_use" | null {
  if (r === "stop") return "end_turn";
  if (r === "length") return "max_tokens";
  if (r === "tool_calls") return "tool_use";
  return null;
}

// ---------------------------------------------------------------------------
// Proxy types (formerly from gateway/types.ts)
// ---------------------------------------------------------------------------

export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ToolUseContentBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContentBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | TextContentBlock[];
  is_error?: boolean;
}

export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock;

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  description?: string;
  input_schema: ToolInputSchema;
}

export type ToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

export interface ProxyRequest {
  model: string;
  messages: Message[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: Tool[];
  tool_choice?: ToolChoice;
  stream?: boolean;
}

export interface ProxyResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "tool_use" | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export interface StreamEvent {
  type:
    | "message_start"
    | "content_block_start"
    | "content_block_delta"
    | "content_block_stop"
    | "message_delta"
    | "message_stop";
  [key: string]: unknown;
}

export interface StreamingConfig {
  flushTimeoutMs: number;
  maxBufferBytes: number;
  enableAggressiveFlushing: boolean;
  enableDiagnostics: boolean;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  flushTimeoutMs: 100,
  maxBufferBytes: 1024,
  enableAggressiveFlushing: false,
  enableDiagnostics: false,
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
