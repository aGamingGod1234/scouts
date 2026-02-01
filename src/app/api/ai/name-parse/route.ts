import { requireAuth } from "@/lib/auth";
import { handleLlmError } from "@/lib/aiError";
import { jsonOk } from "@/lib/http";
import { runLlmTask } from "@/lib/llm";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { nameParseRequestSchema, nameParseResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "ai", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, nameParseRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const result = await runLlmTask({
      userId: auth.user.id,
      task: "NAME_PARSING",
      complexity: "LOW",
      systemPrompt: "You split a personal name into its components.",
      instruction:
        "Return firstName and lastName. Include middleName and suffix only when present.",
      untrustedInput: `Full name: ${parsed.data.fullName}`,
      schema: nameParseResponseSchema,
      temperature: 0,
      maxTokens: 120,
      maxInputChars: 500
    });

    return jsonOk(result.data);
  } catch (error) {
    return handleLlmError(error);
  }
}
