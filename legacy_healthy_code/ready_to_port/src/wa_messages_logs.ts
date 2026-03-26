import fs from "node:fs";

export type WaMessageLogEntry = {
  at: string;
  messageId?: string;
  jid: string;
  isGroup: boolean;
  fromMe: boolean;
  from: string;
  text: string;
  timestamp: number;
  senderJid?: string | null;
  senderAltJids?: string[];
  subject?: string;
  quotedFromJid?: string | null;
  quotedStanzaId?: string | null;
  quotedText?: string;
};

function normalizeEntry(entry: WaMessageLogEntry): WaMessageLogEntry {
  return {
    at: String(entry.at ?? ""),
    messageId: entry.messageId ? String(entry.messageId) : undefined,
    jid: String(entry.jid ?? ""),
    isGroup: Boolean(entry.isGroup),
    fromMe: Boolean(entry.fromMe),
    from: String(entry.from ?? ""),
    text: String(entry.text ?? ""),
    timestamp: Number(entry.timestamp ?? 0) || Date.now(),
    senderJid: entry.senderJid ? String(entry.senderJid) : null,
    senderAltJids: Array.isArray(entry.senderAltJids) ? entry.senderAltJids.map((x) => String(x)) : [],
    subject: entry.subject ? String(entry.subject) : undefined,
    quotedFromJid: entry.quotedFromJid ? String(entry.quotedFromJid) : null,
    quotedStanzaId: entry.quotedStanzaId ? String(entry.quotedStanzaId) : null,
    quotedText: entry.quotedText ? String(entry.quotedText) : undefined
  };
}

export function appendWaMessageLog(path: string, entry: WaMessageLogEntry) {
  const normalized = normalizeEntry(entry);
  const line = `${JSON.stringify(normalized)}\n`;
  fs.appendFileSync(path, line, "utf8");
}

export function readWaMessageLogs(path: string, limit = 200): WaMessageLogEntry[] {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const lines = raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const out: WaMessageLogEntry[] = [];
    for (const ln of lines.slice(-Math.max(1, limit))) {
      try {
        out.push(normalizeEntry(JSON.parse(ln) as WaMessageLogEntry));
      } catch {
        // ignore malformed lines
      }
    }
    return out.reverse(); // newest first
  } catch {
    return [];
  }
}
