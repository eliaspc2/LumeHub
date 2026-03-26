import fs from "node:fs";
import { NormalizedMessage } from "./wa.js";

export type AutomationAction =
  | { type: "log" }
  | { type: "webhook"; url: string; method?: "POST" | "PUT"; headers?: Record<string, string> }
  | { type: "wa_send"; textTemplate?: string };

type WeeklyEntry = {
  id: string;
  type: "weekly";
  daysOfWeek: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
  time: string; // "HH:mm"
  notifyBeforeMinutes: number[];
  messageTemplate?: string;
  actions?: AutomationAction[];
};

type OneShotEntry = {
  id: string;
  type: "oneShot";
  startsAt: string; // "YYYY-MM-DDTHH:mm:ss" (interpreted in local timezone if no TZ suffix)
  notifyBeforeMinutes: number[];
  messageTemplate?: string;
  actions?: AutomationAction[];
};

type AutomationGroup = {
  name: string; // WhatsApp group subject (exact match)
  entries: Array<WeeklyEntry | OneShotEntry>;
};

type AutomationsFile = {
  groups: AutomationGroup[];
};

type FiredState = {
  fired: Record<string, number>; // key -> firedAtMs
};

function parseHm(hm: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) throw new Error(`Invalid time: ${hm}`);
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) throw new Error(`Invalid time: ${hm}`);
  return { h, m: mm };
}

function jsDowToToken(dow: number): WeeklyEntry["daysOfWeek"][number] {
  // JS: 0=Sun..6=Sat
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[dow];
}

function nextWeeklyOccurrence(now: Date, entry: WeeklyEntry): Date {
  const { h, m } = parseHm(entry.time);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const token = jsDowToToken(d.getDay());
    if (!entry.daysOfWeek.includes(token)) continue;

    const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    if (candidate.getTime() > now.getTime() + 1000) return candidate;
  }
  // Fallback (should never happen)
  const d = new Date(now);
  d.setDate(now.getDate() + 7);
  return d;
}

function parseOneShot(startsAt: string): Date | null {
  // Accepts ISO with or without timezone. Without timezone, Node interprets as local time.
  const ms = Date.parse(startsAt);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => String(vars[key] ?? ""));
}

function loadAutomations(path: string): AutomationsFile {
  const raw = fs.readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as AutomationsFile;
  parsed.groups ??= [];
  return parsed;
}

function loadState(path: string): FiredState {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as FiredState;
    parsed.fired ??= {};
    return parsed;
  } catch {
    return { fired: {} };
  }
}

function saveState(path: string, state: FiredState) {
  fs.writeFileSync(path, JSON.stringify(state, null, 2));
}

async function runActions(opts: {
  actions: AutomationAction[];
  waSend: (text: string) => Promise<void>;
  webhookPayload: unknown;
  defaultText: string;
}) {
  for (const action of opts.actions) {
    if (action.type === "log") {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(opts.webhookPayload));
      continue;
    }
    if (action.type === "webhook") {
      await fetch(action.url, {
        method: action.method ?? "POST",
        headers: {
          "content-type": "application/json",
          ...(action.headers ?? {})
        },
        body: JSON.stringify(opts.webhookPayload)
      });
      continue;
    }
    if (action.type === "wa_send") {
      await opts.waSend(action.textTemplate ?? opts.defaultText);
      continue;
    }
  }
}

export function createAutomationsEngine(opts: {
  automationsFile: string;
  stateFile: string;
  resolveGroupJidBySubject: (subject: string) => Promise<string | null>;
  sendText: (jid: string, text: string) => Promise<void>;
  onAlert: (payload: { ruleId: string; jid: string; text: string; timestamp: number }) => Promise<void> | void;
}) {
  let cache: AutomationsFile | null = null;
  let cacheMtimeMs = 0;

  let state = loadState(opts.stateFile);

  function getConfig(): AutomationsFile {
    try {
      const st = fs.statSync(opts.automationsFile);
      if (!cache || st.mtimeMs !== cacheMtimeMs) {
        cache = loadAutomations(opts.automationsFile);
        cacheMtimeMs = st.mtimeMs;
      }
    } catch {
      cache = { groups: [] };
      cacheMtimeMs = 0;
    }
    return cache;
  }

  function firedKey(group: string, entryId: string, startsAtMs: number, offsetMin: number) {
    return `${group}::${entryId}::${startsAtMs}::${offsetMin}`;
  }

  async function tick(now = new Date()) {
    const cfg = getConfig();
    const nowMs = now.getTime();

    for (const g of cfg.groups) {
      const jid = await opts.resolveGroupJidBySubject(g.name);
      if (!jid) continue;

      for (const entry of g.entries) {
        let startsAt: Date | null = null;
        if (entry.type === "weekly") startsAt = nextWeeklyOccurrence(now, entry);
        if (entry.type === "oneShot") startsAt = parseOneShot(entry.startsAt);
        if (!startsAt) continue;

        const startsAtMs = startsAt.getTime();
        if (entry.type === "oneShot" && startsAtMs < nowMs - 60_000) continue;

        for (const offsetMin of entry.notifyBeforeMinutes ?? []) {
          const fireAtMs = startsAtMs - offsetMin * 60_000;
          if (fireAtMs > nowMs) continue;
          if (nowMs - fireAtMs > 120_000) continue; // only fire within a reasonable window

          const key = firedKey(g.name, entry.id, startsAtMs, offsetMin);
          if (state.fired[key]) continue;

          const vars = {
            group: g.name,
            id: entry.id,
            offsetMinutes: offsetMin,
            minutesLeft: Math.max(0, Math.round((startsAtMs - nowMs) / 60_000)),
            time: `${String(startsAt.getHours()).padStart(2, "0")}:${String(startsAt.getMinutes()).padStart(2, "0")}`,
            datetime: startsAt.toISOString()
          };
          const text = entry.messageTemplate
            ? renderTemplate(entry.messageTemplate, vars)
            : `Lembrete (${entry.id}): em ${vars.minutesLeft} min (${vars.datetime})`;

          const payload = {
            kind: "automation",
            group: g.name,
            jid,
            entryId: entry.id,
            type: entry.type,
            startsAt: startsAtMs,
            offsetMinutes: offsetMin,
            text
          };

          await opts.onAlert({ ruleId: `automation:${entry.id}`, jid, text, timestamp: nowMs });
          await runActions({
            actions: entry.actions ?? [{ type: "log" }],
            waSend: async (t) => {
              const rendered = renderTemplate(t, vars);
              await opts.sendText(jid, rendered);
            },
            webhookPayload: payload,
            defaultText: text
          });

          state.fired[key] = nowMs;
          saveState(opts.stateFile, state);
        }
      }
    }
  }

  return {
    start: () => {
      // Keep the loop lightweight; allow a wide fire window below.
      const intervalMs = 10_000;
      const timer = setInterval(() => void tick(new Date()), intervalMs);
      timer.unref?.();
    },
    // future: use this for event-based automations
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleMessage: async (_msg: NormalizedMessage) => {}
  };
}
