import type { ProviderEnhancedError } from "../providers/types.js";

export interface ContextOverflowDetectInput {
  status: number;
  snippet?: string;
  modelId?: string;
  contextWindow?: number;
}

// Patterns that strongly indicate the upstream rejected the request because
// the prompt exceeded the model's context window. Tested case-insensitively
// against the upstream response body. Kept conservative on purpose — false
// positives would rewrite an unrelated 400 into a misleading "context too
// long" message.
const POSITIVE_PATTERNS: readonly RegExp[] = [
  // OpenAI / OpenAI-compatible standard error code.
  /context_length_exceeded/i,
  // Classic OpenAI wording: "This model's maximum context length is N tokens".
  /maximum context length/i,
  // Loose "context length ... exceed" / "context window ... exceed|too long|too large".
  /context\s+length[\s\S]{0,80}?(exceed|too\s+long|too\s+large)/i,
  /context\s+window[\s\S]{0,80}?(exceed|too\s+long|too\s+large)/i,
  // "prompt is too long" (Anthropic-flavored providers / generic gateways).
  /prompt\s+is\s+too\s+long/i,
  // DeepSeek / Anthropic style: "input length and `max_tokens` exceed".
  /input\s+length[\s\S]{0,80}?exceed/i,
  // Chinese upstreams ("上下文" + 过长/超出/太长/超过限制).
  /上下文[\s\S]{0,40}?(过长|超出|太长|超过)/,
  /输入[\s\S]{0,40}?(过长|超出|太长|超过)/,
  // "N tokens exceeds the maximum" variants.
  /tokens?\s+(exceed|超过|超出)/i,
];

export function detectContextOverflow(
  input: ContextOverflowDetectInput
): ProviderEnhancedError | null {
  if (input.status !== 400) return null;
  const snippet = input.snippet;
  if (!snippet) return null;
  if (!POSITIVE_PATTERNS.some((re) => re.test(snippet))) return null;

  return {
    code: "context_length_exceeded",
    message: buildFriendlyMessage(input),
  };
}

function buildFriendlyMessage(input: ContextOverflowDetectInput): string {
  const { modelId, contextWindow, snippet } = input;
  const lines: string[] = [];
  lines.push("Context length exceeded (上下文超出模型限制).");
  lines.push(
    "The conversation history sent by codex exceeds the upstream model's context window."
  );
  if (modelId || contextWindow) {
    const parts: string[] = [];
    if (modelId) parts.push(`当前模型 ${modelId}`);
    if (contextWindow) parts.push(`上下文上限 ${contextWindow} tokens`);
    lines.push(`（${parts.join("，")}）`);
  }
  lines.push("");
  lines.push("How to recover / 如何恢复：");
  lines.push(
    "  • In codex, run /compact to summarize and shrink the history, then retry."
  );
  lines.push("    在 codex 中执行 /compact 压缩历史后重试。");
  lines.push("  • Or start a new session if the task can be split.");
  lines.push("    或开启新会话拆分任务。");
  if (snippet) {
    lines.push("");
    lines.push(`Raw upstream error: ${snippet}`);
  }
  return lines.join("\n");
}
