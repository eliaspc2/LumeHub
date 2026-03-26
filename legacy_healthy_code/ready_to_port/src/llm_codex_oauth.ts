import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_CODEX_OAUTH_MODEL = "gpt-5.4";
const DEFAULT_CODEX_CLIENT_VERSION = "0.116.0";

type CodexAuthJson = {
  tokens?: {
    access_token?: string;
    account_id?: string;
  };
};

type CodexVersionJson = {
  version?: string;
  latest_version?: string;
};

type CodexModelsCatalogEntry = {
  slug?: string;
  supported_in_api?: boolean;
  visibility?: string;
  priority?: number;
};

type CodexModelsCatalogResponse = {
  models?: CodexModelsCatalogEntry[];
};

type CodexEventPayload = {
  type?: string;
  delta?: string;
  text?: string;
  detail?: string;
  error?: { message?: string } | string;
  response?: {
    error?: { message?: string } | string;
    output?: Array<{
      type?: string;
      text?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
};

export type CodexOAuthRequest = {
  model: string;
  instructions: string;
  userText: string;
  authFile?: string;
};

function expandHome(inputPath: string): string {
  const trimmed = String(inputPath ?? "").trim();
  if (!trimmed) return trimmed;
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
}

export function resolveCodexAuthFile(explicitAuthFile?: string): string {
  if (explicitAuthFile?.trim()) {
    return path.resolve(expandHome(explicitAuthFile));
  }
  const codexHome = process.env.CODEX_HOME?.trim()
    ? expandHome(process.env.CODEX_HOME)
    : path.join(os.homedir(), ".codex");
  return path.join(codexHome, "auth.json");
}

function loadCodexAuth(authFile?: string): { accessToken: string; accountId?: string; authFile: string } {
  const resolved = resolveCodexAuthFile(authFile);
  let parsed: CodexAuthJson;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as CodexAuthJson;
  } catch (err) {
    throw new Error(`Nao foi possivel ler auth Codex em ${resolved}: ${String(err)}`);
  }
  const accessToken = parsed?.tokens?.access_token?.trim();
  if (!accessToken) {
    throw new Error(`Credenciais OAuth do Codex invalidas em ${resolved} (access_token em falta).`);
  }
  return {
    accessToken,
    accountId: parsed?.tokens?.account_id?.trim() || undefined,
    authFile: resolved
  };
}

function isValidCodexClientVersion(raw: string | undefined | null): boolean {
  const value = String(raw ?? "").trim();
  return /^\d+\.\d+\.\d+$/.test(value) || /^\d{4}\.\d{2}\.\d{2}$/.test(value);
}

export function resolveCodexClientVersion(explicitAuthFile?: string, preferredClientVersion?: string): string {
  if (isValidCodexClientVersion(preferredClientVersion)) return String(preferredClientVersion).trim();

  const envClientVersion = String(process.env.LLM_CODEX_CLIENT_VERSION ?? "").trim();
  if (isValidCodexClientVersion(envClientVersion)) return envClientVersion;

  const authFile = resolveCodexAuthFile(explicitAuthFile);
  const versionFile = path.join(path.dirname(authFile), "version.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(versionFile, "utf8")) as CodexVersionJson;
    const candidates = [parsed?.version, parsed?.latest_version];
    for (const candidate of candidates) {
      if (isValidCodexClientVersion(candidate)) return String(candidate).trim();
    }
  } catch {
    // ignore missing/unreadable version file
  }

  return DEFAULT_CODEX_CLIENT_VERSION;
}

function uniqueStrings(input: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const value = String(raw ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function extractBestErrorMessage(rawBody: string): string {
  const trimmed = String(rawBody ?? "").trim();
  if (!trimmed) return "(resposta vazia)";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const errorObj = parsed.error;
    const errorMessage =
      errorObj && typeof errorObj === "object" && "message" in errorObj
        ? (errorObj as { message?: unknown }).message
        : undefined;
    const direct =
      (typeof parsed.detail === "string" && parsed.detail) ||
      (typeof parsed.message === "string" && parsed.message) ||
      (typeof errorMessage === "string" && errorMessage);
    if (direct) return direct;
  } catch {
    // keep raw fallback
  }
  return trimmed.length > 800 ? `${trimmed.slice(0, 800)}...` : trimmed;
}

function extractStreamError(payload: CodexEventPayload): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail.trim();
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error.trim();
  if (payload.error && typeof payload.error === "object" && typeof payload.error.message === "string") {
    return payload.error.message.trim();
  }
  if (payload.response?.error && typeof payload.response.error === "object") {
    if (typeof payload.response.error.message === "string" && payload.response.error.message.trim()) {
      return payload.response.error.message.trim();
    }
  }
  return null;
}

function extractCompletedText(payload: CodexEventPayload): string {
  const response = payload.response;
  if (!response || !Array.isArray(response.output)) return "";
  const out: string[] = [];
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.text === "string" && item.text) out.push(item.text);
    if (!Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!part || typeof part !== "object") continue;
      if (typeof part.text === "string" && part.text) out.push(part.text);
    }
  }
  return out.join("");
}

function parseCodexSse(raw: string): { text: string; streamError?: string } {
  const chunks: string[] = [];
  let dataLines: string[] = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    if (!line.trim()) {
      if (dataLines.length > 0) {
        chunks.push(dataLines.join("\n"));
        dataLines = [];
      }
      continue;
    }
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length > 0) chunks.push(dataLines.join("\n"));

  let text = "";
  let streamError: string | undefined;
  let completedText = "";

  for (const chunk of chunks) {
    const payloadRaw = chunk.trim();
    if (!payloadRaw || payloadRaw === "[DONE]") continue;
    let payload: CodexEventPayload;
    try {
      payload = JSON.parse(payloadRaw) as CodexEventPayload;
    } catch {
      continue;
    }

    const maybeErr = extractStreamError(payload);
    if (maybeErr) streamError = maybeErr;

    if (payload.type === "response.output_text.delta" && typeof payload.delta === "string") {
      text += payload.delta;
      continue;
    }
    if (payload.type === "response.output_text.done" && typeof payload.text === "string" && !text) {
      text = payload.text;
      continue;
    }
    if (payload.type === "response.completed") {
      completedText = extractCompletedText(payload);
    }
  }

  const finalText = text || completedText || "";
  return { text: finalText, streamError };
}

export async function runCodexOAuthRequest(input: CodexOAuthRequest): Promise<string> {
  const model = String(input.model ?? "").trim();
  if (!model) throw new Error("Modelo OAuth Codex em falta.");
  const instructions = String(input.instructions ?? "").trim();
  if (!instructions) throw new Error("Instructions em falta para OpenAI Codex OAuth.");

  const auth = loadCodexAuth(input.authFile);
  const body = {
    model,
    instructions,
    input: [{ role: "user", content: [{ type: "input_text", text: String(input.userText ?? "") }] }],
    stream: true,
    store: false
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${auth.accessToken}`,
    accept: "text/event-stream",
    "user-agent": "WA-Notify"
  };
  if (auth.accountId) headers["chatgpt-account-id"] = auth.accountId;

  const res = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const raw = await res.text();
  if (!res.ok) {
    const msg = extractBestErrorMessage(raw);
    throw new Error(`OPENAI_CODEX_OAUTH error ${res.status}: ${msg}`);
  }

  const parsed = parseCodexSse(raw);
  const finalText = String(parsed.text ?? "").trim();
  if (parsed.streamError && !finalText) {
    throw new Error(`OPENAI_CODEX_OAUTH stream error: ${parsed.streamError}`);
  }
  if (!finalText) {
    throw new Error("OPENAI_CODEX_OAUTH resposta vazia.");
  }
  return finalText;
}

export async function fetchCodexOAuthModels(input?: {
  authFile?: string;
  clientVersion?: string;
}): Promise<{ source: string; clientVersion: string; models: string[] }> {
  const auth = loadCodexAuth(input?.authFile);
  const clientVersion = resolveCodexClientVersion(input?.authFile, input?.clientVersion);
  const url = new URL("https://chatgpt.com/backend-api/codex/models");
  url.searchParams.set("client_version", clientVersion);

  const headers: Record<string, string> = {
    authorization: `Bearer ${auth.accessToken}`,
    accept: "application/json",
    "user-agent": "WA-Notify"
  };
  if (auth.accountId) headers["chatgpt-account-id"] = auth.accountId;

  const res = await fetch(url, { headers });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OPENAI_CODEX_OAUTH models error ${res.status}: ${extractBestErrorMessage(raw)}`);
  }

  let parsed: CodexModelsCatalogResponse;
  try {
    parsed = JSON.parse(raw) as CodexModelsCatalogResponse;
  } catch (err) {
    throw new Error(`OPENAI_CODEX_OAUTH models payload invalido: ${String(err)}`);
  }

  const rows = Array.isArray(parsed?.models) ? parsed.models.slice() : [];
  rows.sort((a, b) => {
    const aPriority = Number.isFinite(a?.priority) ? Number(a?.priority) : Number.MAX_SAFE_INTEGER;
    const bPriority = Number.isFinite(b?.priority) ? Number(b?.priority) : Number.MAX_SAFE_INTEGER;
    return aPriority - bPriority;
  });

  const models = uniqueStrings(
    rows
      .filter((row) => row?.supported_in_api !== false)
      .map((row) => String(row?.slug ?? "").trim())
  );

  return { source: url.toString(), clientVersion, models };
}

export function isCodexCreditLimitErrorMessage(raw: string): boolean {
  const msg = String(raw ?? "").toLowerCase();
  if (!msg) return false;
  if (msg.includes("hit your chatgpt usage limit") && msg.includes("try again in")) return true;
  if (msg.includes("insufficient credits")) return true;
  if (msg.includes("credit balance")) return true;
  if (msg.includes("payment required")) return true;
  if (msg.includes("exceeded your current quota")) return true;
  if (msg.includes("quota exceeded")) return true;
  if (msg.includes("insufficient_quota")) return true;
  if (msg.includes("http 402")) return true;
  if (msg.includes("error 402")) return true;
  if (/\b402\b/.test(msg) && (msg.includes("billing") || msg.includes("payment"))) return true;
  return false;
}
