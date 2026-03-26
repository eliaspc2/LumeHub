import fs from "node:fs";

export type LlmLogEntry = {
  at: string;
  kind: "chat" | "parse" | "apply" | "fix";
  source?: "api" | "whatsapp" | "gui";
  provider?: string;
  ok: boolean;
  error?: string;
  inputPreview?: string;
  context?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export function appendLlmLog(path: string, entry: LlmLogEntry) {
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(path, line, "utf8");
}

export function readLlmLogs(path: string, limit = 200): LlmLogEntry[] {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const lines = raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const out: LlmLogEntry[] = [];
    for (const ln of lines.slice(-Math.max(1, limit))) {
      try {
        out.push(JSON.parse(ln) as LlmLogEntry);
      } catch {
        // ignore malformed lines
      }
    }
    return out.reverse(); // newest first
  } catch {
    return [];
  }
}

