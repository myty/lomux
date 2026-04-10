# API Reference

Modmux exposes Anthropic-compatible and OpenAI-compatible HTTP endpoints. All
requests are proxied to GitHub Copilot with automatic token management.

## Base URL

```
http://localhost:11435
```

Modmux scans for an available port starting at 11435 if the default is occupied.

## Authentication

Modmux manages GitHub Copilot tokens automatically. Authenticate once with
`modmux start` and tokens are included in all proxied requests.

## Content Types

All endpoints accept and return `application/json`.

## Error Handling

All endpoints follow consistent error response formats:

### Anthropic-compatible Endpoints

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Error description",
    "param": "field_name"
  }
}
```

### OpenAI-compatible Endpoints

```json
{
  "error": {
    "message": "Error description",
    "type": "invalid_request_error",
    "param": "field_name",
    "code": "invalid_value"
  }
}
```

## Error Types

| Error Type              | Description               |
| ----------------------- | ------------------------- |
| `invalid_request_error` | Request validation failed |
| `service_error`         | Internal server error     |
| `api_error`             | Upstream API error        |

## Rate Limiting

Modmux inherits rate limiting from GitHub Copilot. Rate limit headers are passed
through from the upstream service.

## Endpoints

### Core Endpoints

- **[/v1/messages](./anthropic-proxy.md)** - Anthropic-compatible chat
  completions
- **[/v1/chat/completions](./openai-proxy.md)** - OpenAI-compatible chat
  completions
- **[/v1/responses](./usage-metrics.md#responses-endpoint)** - OpenAI Responses
  API (for Codex compatibility)

### Utility Endpoints

- **[/v1/models](./openai-proxy.md#models-endpoint)** - List available models
- **[/v1/usage](./usage-metrics.md#usage-endpoint)** - Usage metrics and
  statistics
- **[/v1/messages/count_tokens](./token-counting.md)** - Token counting utility
- **[/health](#health-endpoint)** - Service health check

### Health Endpoint

Simple health check endpoint for service monitoring.

**Request:**

```http
GET /health
```

**Response:**

```json
{
  "status": "ok"
}
```

## Model Support

Modmux supports GitHub Copilot models with automatic model resolution:

### Model Aliases

| Alias                        | Resolved Model |
| ---------------------------- | -------------- |
| `claude-3-5-sonnet-20241022` | `gpt-4o`       |
| `claude-3-5-haiku-20241022`  | `gpt-4o-mini`  |
| `claude-3-opus-20240229`     | `o1-preview`   |

Models are resolved dynamically and the actual available models depend on your
GitHub Copilot subscription.

## Agent Detection

Modmux automatically detects the calling agent from the User-Agent header for
metrics tracking:

| User-Agent Contains        | Detected Agent |
| -------------------------- | -------------- |
| `claude-code`, `anthropic` | `claude-code`  |
| `cline`                    | `cline`        |
| `codex`                    | `codex`        |

## Usage Metrics

All requests are tracked for usage metrics with the following dimensions:

- **endpoint** - The API endpoint called
- **agent** - The detected agent (from User-Agent)
- **model** - The requested model
- **status** - HTTP response status
- **duration** - Request duration in milliseconds

Access usage data via the
[/v1/usage endpoint](./usage-metrics.md#usage-endpoint).

## Endpoint Documentation

- [Anthropic Proxy](./anthropic-proxy.md) — `/v1/messages`
- [OpenAI Proxy](./openai-proxy.md) — `/v1/chat/completions` and `/v1/models`
- [Usage Metrics](./usage-metrics.md) — `/v1/usage` and `/v1/responses`
- [Token Counting](./token-counting.md) — `/v1/messages/count_tokens`
