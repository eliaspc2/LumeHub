import fs from "node:fs";
import crypto from "node:crypto";

export type PersonMemoryNote = {
  at: string;
  text: string;
};

export type PersonMemoryEntry = {
  id: string;
  name?: string;
  identifiers: string[];
  important: PersonMemoryNote[];
  createdAt: string;
  updatedAt: string;
};

export type PeopleMemoryFile = {
  people: PersonMemoryEntry[];
};

function normalizeIdentifier(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return t;
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const t = normalizeIdentifier(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function jidDigits(id: string): string | null {
  const m = /^(\d{6,})@/i.exec(String(id ?? "").trim());
  return m?.[1] ?? null;
}

function idsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const da = jidDigits(a);
  const db = jidDigits(b);
  return Boolean(da && db && da === db);
}

function normalizeMemory(cfg: PeopleMemoryFile): PeopleMemoryFile {
  const people = Array.isArray(cfg.people) ? cfg.people : [];
  const out: PersonMemoryEntry[] = [];

  for (const p of people) {
    if (!p || typeof p !== "object") continue;
    const identifiers = uniqueStrings(Array.isArray(p.identifiers) ? p.identifiers.map((x) => String(x)) : []);
    if (identifiers.length === 0) continue;

    const importantRaw = Array.isArray(p.important) ? p.important : [];
    const important: PersonMemoryNote[] = [];
    const seen = new Set<string>();
    for (const n of importantRaw) {
      if (!n || typeof n !== "object") continue;
      const text = String((n as { text?: unknown }).text ?? "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      important.push({ at: String((n as { at?: unknown }).at ?? new Date().toISOString()), text });
    }

    out.push({
      id: String(p.id ?? crypto.randomUUID()),
      name: p.name ? String(p.name).trim() || undefined : undefined,
      identifiers,
      important,
      createdAt: String(p.createdAt ?? new Date().toISOString()),
      updatedAt: String(p.updatedAt ?? new Date().toISOString())
    });
  }

  return { people: out };
}

function atomicWriteJson(path: string, value: unknown) {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, path);
}

export function loadPeopleMemory(path: string): PeopleMemoryFile {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as PeopleMemoryFile;
    return normalizeMemory(parsed && typeof parsed === "object" ? parsed : { people: [] });
  } catch {
    return { people: [] };
  }
}

export function savePeopleMemory(path: string, cfg: PeopleMemoryFile) {
  atomicWriteJson(path, normalizeMemory(cfg));
}

function findIndexByIdentifiers(cfg: PeopleMemoryFile, identifiers: string[]): number {
  const ids = uniqueStrings(identifiers);
  if (ids.length === 0) return -1;

  return cfg.people.findIndex((p) => {
    for (const a of p.identifiers) {
      for (const b of ids) {
        if (idsMatch(a, b)) return true;
      }
    }
    return false;
  });
}

export function findPersonByIdentifiers(path: string, identifiers: string[]): PersonMemoryEntry | null {
  const cfg = loadPeopleMemory(path);
  const idx = findIndexByIdentifiers(cfg, identifiers);
  if (idx < 0) return null;
  return cfg.people[idx];
}

export function upsertPersonByIdentifiers(path: string, identifiers: string[], patch?: { name?: string }): PersonMemoryEntry | null {
  const ids = uniqueStrings(identifiers);
  if (ids.length === 0) return null;

  const cfg = loadPeopleMemory(path);
  const now = new Date().toISOString();
  const idx = findIndexByIdentifiers(cfg, ids);

  if (idx >= 0) {
    const cur = cfg.people[idx];
    const mergedIds = uniqueStrings([...(cur.identifiers ?? []), ...ids]);
    const next: PersonMemoryEntry = {
      ...cur,
      name: patch?.name ? String(patch.name).trim() || cur.name : cur.name,
      identifiers: mergedIds,
      updatedAt: now
    };
    cfg.people[idx] = next;
    savePeopleMemory(path, cfg);
    return next;
  }

  const created: PersonMemoryEntry = {
    id: crypto.randomUUID(),
    name: patch?.name ? String(patch.name).trim() || undefined : undefined,
    identifiers: ids,
    important: [],
    createdAt: now,
    updatedAt: now
  };
  cfg.people.push(created);
  savePeopleMemory(path, cfg);
  return created;
}

export function appendImportantMemory(path: string, identifiers: string[], text: string): PersonMemoryEntry | null {
  const note = String(text ?? "").trim();
  if (!note) return null;

  const cfg = loadPeopleMemory(path);
  const idx = findIndexByIdentifiers(cfg, identifiers);
  if (idx < 0) return null;

  const cur = cfg.people[idx];
  if (cur.important.some((x) => x.text === note)) return cur;

  const next: PersonMemoryEntry = {
    ...cur,
    important: [...cur.important, { at: new Date().toISOString(), text: note }].slice(-120),
    updatedAt: new Date().toISOString()
  };
  cfg.people[idx] = next;
  savePeopleMemory(path, cfg);
  return next;
}
