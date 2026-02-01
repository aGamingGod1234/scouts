import "server-only";
import { jsonError } from "@/lib/http";
import { LlmError } from "@/lib/llm";

export function handleLlmError(error: unknown) {
  if (error instanceof LlmError) {
    if (error.code === "RATE_LIMIT") {
      return jsonError(
        "RATE_LIMIT",
        "Too many AI requests. Please wait a moment and try again.",
        undefined,
        429
      );
    }
    if (error.code === "CONFIG") {
      return jsonError(
        "INTERNAL_ERROR",
        "AI is not configured. Please contact support.",
        undefined,
        500
      );
    }
    if (error.code === "INVALID_OUTPUT" || error.code === "INVALID_RESPONSE") {
      return jsonError(
        "UPSTREAM_ERROR",
        "AI returned an unexpected response. Please try again.",
        undefined,
        502
      );
    }
    if (error.code === "TIMEOUT") {
      return jsonError(
        "UPSTREAM_ERROR",
        "AI request timed out. Please try again.",
        undefined,
        504
      );
    }
    return jsonError(
      "UPSTREAM_ERROR",
      "AI service is temporarily unavailable. Please try again.",
      undefined,
      502
    );
  }

  return jsonError(
    "INTERNAL_ERROR",
    "Failed to process AI request.",
    undefined,
    500
  );
}
