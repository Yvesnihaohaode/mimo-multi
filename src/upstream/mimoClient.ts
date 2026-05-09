import type { ChatRequest } from "../translate/types.js";
import { log, redactKey } from "../util/log.js";

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string;
  userAgent: string;
  connectTimeoutMs?: number;
  idleTimeoutMs?: number;
}

// Marker that MiMo emits in 400 responses when web_search is forwarded but
// the user's account doesn't have the Web Search Plugin activated.
// Full param string: "web search tool found in the request body, but webSearchEnabled is false"
const WEB_SEARCH_DISABLED_MARKER = "webSearchEnabled is false";

const WEB_SEARCH_HINT =
  "MiMo Web Search Plugin is not activated for this account. " +
  "Activate it at https://platform.xiaomimimo.com/#/console/plugin (separately billed) " +
  "and restart mimo2codex. The model has decided to call web_search; if your account " +
  "doesn't include the plugin, this request will keep failing until activated.";

export class UpstreamError extends Error {
  status: number;
  bodySnippet?: string;
  code: string;

  constructor(opts: { status: number; message: string; code: string; bodySnippet?: string }) {
    super(opts.message);
    this.name = "UpstreamError";
    this.status = opts.status;
    this.code = opts.code;
    this.bodySnippet = opts.bodySnippet;
  }
}

function buildUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/chat/completions`;
}

function authHeader(apiKey: string): Record<string, string> {
  // MiMo accepts both "Authorization: Bearer" and "api-key". Bearer is more
  // universally supported by intermediaries, so we use it.
  return { Authorization: `Bearer ${apiKey}` };
}

async function readSnippet(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    return text.length > 800 ? `${text.slice(0, 800)}…` : text;
  } catch {
    return undefined;
  }
}

export async function callMimo(
  cfg: UpstreamConfig,
  body: ChatRequest,
  signal: AbortSignal
): Promise<Response> {
  const url = buildUrl(cfg.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: body.stream ? "text/event-stream" : "application/json",
    "User-Agent": cfg.userAgent,
    ...authHeader(cfg.apiKey),
  };

  log.debug(`upstream POST ${url}`, {
    model: body.model,
    stream: !!body.stream,
    messages: body.messages.length,
    tools: body.tools?.length ?? 0,
    apiKey: redactKey(cfg.apiKey),
  });
  // Full body in --verbose. Useful when MiMo returns an opaque 400 — you can
  // see exactly what the proxy sent. No api key leaks; that's only in headers.
  log.debug("upstream POST body", body);

  const attempt = async (): Promise<Response> => {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
    return res;
  };

  let res: Response;
  try {
    res = await attempt();
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    // Retry once on transient network errors.
    log.warn("upstream connect failed, retrying once", { error: (err as Error).message });
    try {
      res = await attempt();
    } catch (err2) {
      throw new UpstreamError({
        status: 502,
        code: "upstream_unreachable",
        message: `failed to reach MiMo: ${(err2 as Error).message}`,
      });
    }
  }

  if (!res.ok) {
    const snippet = await readSnippet(res);
    const code =
      res.status === 401
        ? "authentication_error"
        : res.status === 403
          ? "permission_denied"
          : res.status === 429
            ? "rate_limit_exceeded"
            : res.status >= 500
              ? "server_error"
              : res.status === 400 && snippet?.includes(WEB_SEARCH_DISABLED_MARKER)
                ? "web_search_plugin_not_activated"
                : "bad_request";
    const message =
      res.status === 400 && snippet?.includes(WEB_SEARCH_DISABLED_MARKER)
        ? `${WEB_SEARCH_HINT} (raw: ${snippet})`
        : `MiMo returned ${res.status}: ${snippet ?? "(no body)"}`;
    if (res.status === 400 && snippet?.includes(WEB_SEARCH_DISABLED_MARKER)) {
      log.warn(WEB_SEARCH_HINT);
    }
    throw new UpstreamError({
      status: res.status,
      code,
      message,
      bodySnippet: snippet,
    });
  }

  return res;
}
