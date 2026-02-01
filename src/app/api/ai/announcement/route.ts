import { requireAuth } from "@/lib/auth";
import { handleLlmError } from "@/lib/aiError";
import { jsonOk } from "@/lib/http";
import { runLlmTask } from "@/lib/llm";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import {
  announcementGenerateRequestSchema,
  announcementGenerateResponseSchema
} from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "ai", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, announcementGenerateRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { topic, audience, tone, details, length } = parsed.data;
  const briefing = [
    `Topic: ${topic}`,
    audience ? `Audience: ${audience}` : null,
    tone ? `Tone: ${tone}` : null,
    length ? `Length: ${length}` : null,
    details ? `Details:\n${details}` : null
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await runLlmTask({
      userId: auth.user.id,
      task: "ANNOUNCEMENT",
      complexity: "HIGH",
      systemPrompt: "You draft school announcements for staff and students.",
      instruction:
        "Generate a title and a polished announcement body. Keep it clear, practical, and aligned with the requested tone.",
      untrustedInput: briefing,
      schema: announcementGenerateResponseSchema,
      temperature: 0.7,
      maxTokens: 600,
      maxInputChars: 6_000
    });

    return jsonOk(result.data);
  } catch (error) {
    return handleLlmError(error);
  }
}
