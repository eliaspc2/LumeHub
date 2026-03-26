import fs from "node:fs";

export type LlmConfigFile = {
  provider?: "none" | "ollama" | "http" | "openai_compat" | "openai_codex_oauth";
  // For simplicity, a single URL/model/apikey in the GUI. Backend maps it depending on provider.
  url?: string;
  model?: string;
  apiKey?: string;
  // OpenAI Codex OAuth primary model (chatgpt.com/backend-api/codex/responses).
  oauthModel?: string;
  // Optional path to Codex auth.json (default: $CODEX_HOME/auth.json or ~/.codex/auth.json).
  codexAuthPath?: string;
};

export function loadLlmConfig(path: string): LlmConfigFile {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as LlmConfigFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLlmConfig(path: string, cfg: LlmConfigFile) {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, path);
}

export function redactLlmConfig(cfg: LlmConfigFile): LlmConfigFile & { note?: string } {
  const out: LlmConfigFile & { note?: string } = { ...cfg };
  if (out.apiKey) out.apiKey = "********";
  out.note = out.apiKey === "********" ? "apiKey guardada (nao e mostrada)" : "OK";
  return out;
}
