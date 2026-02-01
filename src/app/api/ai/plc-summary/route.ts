import { requireAuth } from "@/lib/auth";
import { handleLlmError } from "@/lib/aiError";
import { jsonOk } from "@/lib/http";
import { runLlmTask } from "@/lib/llm";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { plcSummaryRequestSchema, plcSummaryResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "ai", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, plcSummaryRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const meetingDetails = [
    parsed.data.meetingTitle ? `Meeting title: ${parsed.data.meetingTitle}` : null,
    parsed.data.focus ? `Focus: ${parsed.data.focus}` : null,
    `Transcript:\n${parsed.data.transcript}`
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const result = await runLlmTask({
      userId: auth.user.id,
      task: "PLC_SUMMARY",
      complexity: "HIGH",
      systemPrompt: "You summarize PLC meetings and extract action items for educators.",
      instruction:
        "Provide a concise meeting summary and a list of action items. Use an empty array when no action items are present.",
      untrustedInput: meetingDetails,
      schema: plcSummaryResponseSchema,
      temperature: 0.2,
      maxTokens: 700,
      maxInputChars: 12_000
    });

    return jsonOk(result.data);
  } catch (error) {
    return handleLlmError(error);
  }
}
