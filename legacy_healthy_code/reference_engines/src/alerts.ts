import fs from "node:fs";
import { NormalizedMessage } from "./wa.js";

type AlertsFile = {
  rules: AlertRule[];
};

type AlertRule = {
  id: string;
  enabled?: boolean;
  scope:
    | { type: "any" }
    | { type: "group"; jid: string }
    | { type: "group"; subject: string }
    | { type: "chat"; jid: string };
  match:
    | { type: "includes"; value: string; caseInsensitive?: boolean }
    | { type: "regex"; pattern: string };
  actions: Array<
    | { type: "webhook"; url: string; method?: "POST" | "PUT"; headers?: Record<string, string> }
    | { type: "log" }
  >;
};

function readAlertsFile(path: string): AlertsFile {
  const raw = fs.readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as AlertsFile;
  parsed.rules ??= [];
  return parsed;
}

function matchRule(rule: AlertRule, msg: NormalizedMessage): boolean {
  if (rule.enabled === false) return false;

  if (rule.scope.type === "group" && "jid" in rule.scope) {
    if (!msg.isGroup) return false;
    if (msg.jid !== rule.scope.jid) return false;
  }
  if (rule.scope.type === "group" && "subject" in rule.scope) {
    if (!msg.isGroup) return false;
    if (!msg.subject) return false;
    if (msg.subject !== rule.scope.subject) return false;
  }
  if (rule.scope.type === "chat") {
    if (msg.jid !== rule.scope.jid) return false;
  }

  const text = msg.text ?? "";
  if (rule.match.type === "includes") {
    const needle = rule.match.value ?? "";
    if (!needle) return false;
    if (rule.match.caseInsensitive) return text.toLowerCase().includes(needle.toLowerCase());
    return text.includes(needle);
  }
  if (rule.match.type === "regex") {
    const re = new RegExp(rule.match.pattern);
    return re.test(text);
  }
  return false;
}

async function runActions(rule: AlertRule, msg: NormalizedMessage) {
  for (const action of rule.actions ?? []) {
    if (action.type === "log") {
      // eslint-disable-next-line no-console
      console.log(`[alert:${rule.id}] ${msg.jid} ${msg.from}: ${msg.text}`);
      continue;
    }
    if (action.type === "webhook") {
      const method = action.method ?? "POST";
      await fetch(action.url, {
        method,
        headers: {
          "content-type": "application/json",
          ...(action.headers ?? {})
        },
        body: JSON.stringify({
          ruleId: rule.id,
          jid: msg.jid,
          from: msg.from,
          text: msg.text,
          timestamp: msg.timestamp
        })
      });
      continue;
    }
  }
}

export function createAlertEngine(opts: {
  alertsFile: string;
  onAlert: (payload: { ruleId: string; jid: string; text: string; timestamp: number }) => Promise<void> | void;
}) {
  let cache: AlertsFile | null = null;
  let cacheMtimeMs = 0;

  function getRules(): AlertRule[] {
    try {
      const st = fs.statSync(opts.alertsFile);
      if (!cache || st.mtimeMs !== cacheMtimeMs) {
        cache = readAlertsFile(opts.alertsFile);
        cacheMtimeMs = st.mtimeMs;
      }
    } catch {
      cache = { rules: [] };
      cacheMtimeMs = 0;
    }
    return cache.rules ?? [];
  }

  return {
    handleMessage: async (msg: NormalizedMessage) => {
      const rules = getRules();
      for (const rule of rules) {
        if (!matchRule(rule, msg)) continue;
        await opts.onAlert({ ruleId: rule.id, jid: msg.jid, text: msg.text, timestamp: msg.timestamp });
        await runActions(rule, msg);
      }
    }
  };
}
