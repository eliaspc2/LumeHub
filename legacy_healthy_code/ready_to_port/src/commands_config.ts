import fs from "node:fs";

export type CommandsConfigFile = {
  privateAllowedSenders?: string[];
  groupAllowedJids?: string[];
  ownerOnlyMode?: boolean;
  ownerAllowedSenders?: string[];
  ownerAssistantMode?: boolean;
  ownerTerminalEnabled?: boolean;
  directRepliesEnabled?: boolean;
  logGroupInteractions?: boolean;
};

function normalizeJidLike(raw: string, chatKind: "private" | "group"): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (t.includes("@")) return t;

  const digits = t.replace(/\D+/g, "");
  if (!digits) return null;
  if (chatKind === "private") return `${digits}@s.whatsapp.net`;
  return `${digits}@g.us`;
}

function normalizeList(values: unknown, chatKind: "private" | "group"): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const jid = normalizeJidLike(String(v ?? ""), chatKind);
    if (!jid) continue;
    if (seen.has(jid)) continue;
    seen.add(jid);
    out.push(jid);
  }
  return out;
}

function normalizeConfig(cfg: CommandsConfigFile): CommandsConfigFile {
  return {
    privateAllowedSenders: normalizeList(cfg.privateAllowedSenders, "private"),
    groupAllowedJids: normalizeList(cfg.groupAllowedJids, "group"),
    ownerOnlyMode: Boolean(cfg.ownerOnlyMode ?? false),
    ownerAllowedSenders: normalizeList(cfg.ownerAllowedSenders, "private"),
    ownerAssistantMode: Boolean(cfg.ownerAssistantMode ?? true),
    ownerTerminalEnabled: Boolean(cfg.ownerTerminalEnabled ?? true),
    directRepliesEnabled: cfg.directRepliesEnabled == null ? true : Boolean(cfg.directRepliesEnabled),
    logGroupInteractions: cfg.logGroupInteractions == null ? true : Boolean(cfg.logGroupInteractions)
  };
}

export function parseCsvJidList(raw: string | undefined, chatKind: "private" | "group"): string[] {
  const txt = String(raw ?? "").trim();
  if (!txt) return [];
  const values = txt
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return normalizeList(values, chatKind);
}

export function loadCommandsConfig(path: string): CommandsConfigFile {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as CommandsConfigFile;
    if (!parsed || typeof parsed !== "object") return normalizeConfig({});
    return normalizeConfig(parsed);
  } catch {
    return normalizeConfig({});
  }
}

export function saveCommandsConfig(path: string, cfg: CommandsConfigFile) {
  const tmp = `${path}.tmp`;
  const normalized = normalizeConfig(cfg);
  fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2));
  fs.renameSync(tmp, path);
}
