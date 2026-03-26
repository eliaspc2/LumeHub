import fs from "node:fs";
import nodePath from "node:path";
import { loadInstructionQueue } from "./instruction_queue.js";
import { loadSchedules, type ScheduleItem } from "./schedules.js";

export type DeliveryWatchdogIssueKind = "schedule_error" | "schedule_overdue" | "queue_failed";

export type DeliveryWatchdogIssue = {
  key: string;
  kind: DeliveryWatchdogIssueKind;
  firstSeenAt: string;
  lastSeenAt: string;
  alertSentAt?: string;
  resolvedAt?: string;
  weekId?: string;
  refId?: string;
  message: string;
  meta?: Record<string, string>;
};

export type DeliveryWatchdogFile = {
  version: 1;
  lastTickAt?: string;
  lastAlertAt?: string;
  lastError?: string;
  issues: DeliveryWatchdogIssue[];
};

export type DeliveryWatchdogSummary = {
  activeIssueCount: number;
  alertedActiveCount: number;
  resolvedIssueCount: number;
  ownerTargets: string[];
  activeIssues: DeliveryWatchdogIssue[];
  lastTickAt?: string;
  lastAlertAt?: string;
  lastError?: string;
};

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function atomicWriteJson(path: string, value: unknown) {
  fs.mkdirSync(nodePath.dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, path);
}

function cleanString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const text = cleanString(raw);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function parseIsoDateOrNull(value: unknown): Date | null {
  const date = new Date(String(value ?? ""));
  return Number.isFinite(date.getTime()) ? date : null;
}

function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function startOfIsoWeekLocal(date: Date): Date {
  const out = startOfDayLocal(date);
  const day = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - day);
  return out;
}

function inferWeekId(item: { eventAt?: unknown; sendAt?: unknown }): string | undefined {
  const baseDate = parseIsoDateOrNull(item.eventAt) ?? parseIsoDateOrNull(item.sendAt);
  if (!baseDate) return undefined;
  const local = startOfDayLocal(baseDate);
  const weekStart = startOfIsoWeekLocal(local);
  const thursday = new Date(local);
  thursday.setDate(local.getDate() + 3 - ((local.getDay() + 6) % 7));
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week1Start = startOfIsoWeekLocal(jan4);
  const week = 1 + Math.round((weekStart.getTime() - week1Start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `w${String(week).padStart(2, "0")}y${year}`;
}

function formatDateTime(value: string | undefined): string {
  const date = parseIsoDateOrNull(value);
  if (!date) return String(value ?? "-");
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function buildScheduleIssueMessage(kind: DeliveryWatchdogIssueKind, item: ScheduleItem): string {
  const weekId = inferWeekId(item) ?? "-";
  const target = cleanString(item.label) ?? cleanString(item.group) ?? cleanString(item.jid) ?? "(sem alvo)";
  const refId = cleanString(item.id) ?? "-";
  const sendAt = formatDateTime(cleanString(item.sendAt));
  const error = cleanString(item.error);
  if (kind === "schedule_error") {
    return `[WA-Notify watchdog] Falha ao preparar/enviar agendamento ${refId} (${weekId}) para ${target}. sendAt: ${sendAt}. Erro: ${error ?? "desconhecido"}.`;
  }
  return `[WA-Notify watchdog] Agendamento em atraso ${refId} (${weekId}) para ${target}. sendAt previsto: ${sendAt}. Ultimo erro: ${error ?? "sem detalhe"}.`;
}

function buildQueueIssueMessage(issue: DeliveryWatchdogIssue): string {
  const refId = cleanString(issue.refId) ?? "-";
  const weekId = cleanString(issue.weekId) ?? "-";
  const detail = cleanString(issue.meta?.error) ?? cleanString(issue.meta?.kind) ?? "falha sem detalhe";
  return `[WA-Notify watchdog] Falha na fila de instrucoes. Ref: ${refId} | semana: ${weekId} | detalhe: ${detail}.`;
}

function normalizeIssue(raw: unknown): DeliveryWatchdogIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const kind = cleanString(row.kind);
  if (kind !== "schedule_error" && kind !== "schedule_overdue" && kind !== "queue_failed") return null;
  const metaRaw = row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : {};
  const metaEntries = Object.entries(metaRaw)
    .map(([key, value]) => [key, cleanString(value)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));
  return {
    key: cleanString(row.key) ?? `${kind}:${cleanString(row.refId) ?? "unknown"}`,
    kind,
    firstSeenAt: cleanString(row.firstSeenAt) ?? new Date().toISOString(),
    lastSeenAt: cleanString(row.lastSeenAt) ?? new Date().toISOString(),
    alertSentAt: cleanString(row.alertSentAt),
    resolvedAt: cleanString(row.resolvedAt),
    weekId: cleanString(row.weekId),
    refId: cleanString(row.refId),
    message: cleanString(row.message) ?? "Problema detetado.",
    meta: metaEntries.length > 0 ? Object.fromEntries(metaEntries) : undefined
  };
}

export function loadDeliveryWatchdogState(path: string): DeliveryWatchdogFile {
  const raw = readJsonFile<Partial<DeliveryWatchdogFile>>(path, { version: 1, issues: [] });
  return {
    version: 1,
    lastTickAt: cleanString(raw.lastTickAt),
    lastAlertAt: cleanString(raw.lastAlertAt),
    lastError: cleanString(raw.lastError),
    issues: Array.isArray(raw.issues) ? raw.issues.map(normalizeIssue).filter((issue): issue is DeliveryWatchdogIssue => Boolean(issue)) : []
  };
}

function persistDeliveryWatchdogState(path: string, state: DeliveryWatchdogFile) {
  atomicWriteJson(path, state);
}

export function summarizeDeliveryWatchdog(state: DeliveryWatchdogFile, ownerTargets: string[]): DeliveryWatchdogSummary {
  const activeIssues = state.issues.filter((issue) => !issue.resolvedAt);
  return {
    activeIssueCount: activeIssues.length,
    alertedActiveCount: activeIssues.filter((issue) => Boolean(issue.alertSentAt)).length,
    resolvedIssueCount: state.issues.filter((issue) => Boolean(issue.resolvedAt)).length,
    ownerTargets: uniqueStrings(ownerTargets),
    activeIssues,
    lastTickAt: cleanString(state.lastTickAt),
    lastAlertAt: cleanString(state.lastAlertAt),
    lastError: cleanString(state.lastError)
  };
}

function collectCurrentIssues(input: {
  schedulesFile: string;
  queueFile: string;
  overdueGraceMs: number;
  nowMs: number;
}): DeliveryWatchdogIssue[] {
  const issues: DeliveryWatchdogIssue[] = [];
  const nowIso = new Date(input.nowMs).toISOString();

  const schedules = loadSchedules(input.schedulesFile);
  for (const item of schedules.items ?? []) {
    const sendAt = Date.parse(String(item.sendAt ?? ""));
    const weekId = inferWeekId(item);
    const refId = cleanString(item.id);
    if (item.status === "error") {
      issues.push({
        key: `schedule_error:${refId ?? "unknown"}`,
        kind: "schedule_error",
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        weekId,
        refId,
        message: buildScheduleIssueMessage("schedule_error", item),
        meta: {
          error: cleanString(item.error) ?? "desconhecido",
          sendAt: cleanString(item.sendAt) ?? "-"
        }
      });
      continue;
    }

    const enabled = item.enabled ?? true;
    const status = cleanString(item.status) ?? "pending";
    const isPendingLike = !status || status === "pending" || status === "sending";
    if (!enabled || !isPendingLike || !Number.isFinite(sendAt)) continue;
    const effectiveDueAt =
      status === "sending" && typeof item.retryAfter === "number" && Number.isFinite(item.retryAfter)
        ? Math.max(sendAt, item.retryAfter)
        : sendAt;
    if (input.nowMs < effectiveDueAt + input.overdueGraceMs) continue;

    issues.push({
      key: `schedule_overdue:${refId ?? "unknown"}`,
      kind: "schedule_overdue",
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      weekId,
      refId,
      message: buildScheduleIssueMessage("schedule_overdue", item),
      meta: {
        error: cleanString(item.error) ?? "sem detalhe",
        sendAt: cleanString(item.sendAt) ?? "-"
      }
    });
  }

  const queue = loadInstructionQueue(input.queueFile);
  for (const instruction of queue.instructions) {
    for (const action of instruction.actions) {
      if (action.status !== "failed") continue;
      const weekId = cleanString(action.weekId) ?? cleanString(action.result?.weekId);
      const refId = `${instruction.id}:${action.id}`;
      issues.push({
        key: `queue_failed:${refId}`,
        kind: "queue_failed",
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        weekId,
        refId,
        message: "",
        meta: {
          instructionId: instruction.id,
          actionId: action.id,
          kind: action.kind,
          error: cleanString(action.error) ?? "desconhecido"
        }
      });
    }
  }

  for (const issue of issues) {
    if (issue.kind === "queue_failed") issue.message = buildQueueIssueMessage(issue);
  }

  return issues;
}

export function createDeliveryWatchdog(opts: {
  watchdogFile: string;
  schedulesFile: string;
  queueFile: string;
  intervalMs?: number;
  overdueGraceMs?: number;
  resolveOwnerTargets: () => string[];
  sendText: (jid: string, text: string) => Promise<void>;
}) {
  async function tick() {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const ownerTargets = uniqueStrings(opts.resolveOwnerTargets());
    const state = loadDeliveryWatchdogState(opts.watchdogFile);

    try {
      const currentIssues = collectCurrentIssues({
        schedulesFile: opts.schedulesFile,
        queueFile: opts.queueFile,
        overdueGraceMs: opts.overdueGraceMs ?? 5 * 60 * 1000,
        nowMs
      });
      const byKey = new Map(state.issues.map((issue) => [issue.key, issue]));
      const activeKeys = new Set<string>();

      for (const current of currentIssues) {
        activeKeys.add(current.key);
        const existing = byKey.get(current.key);
        if (existing && !existing.resolvedAt) {
          existing.lastSeenAt = nowIso;
          existing.weekId = current.weekId;
          existing.refId = current.refId;
          existing.message = current.message;
          existing.meta = current.meta;
          continue;
        }

        const nextIssue: DeliveryWatchdogIssue = {
          ...current,
          firstSeenAt: nowIso,
          lastSeenAt: nowIso,
          alertSentAt: undefined,
          resolvedAt: undefined
        };
        state.issues.push(nextIssue);
        byKey.set(nextIssue.key, nextIssue);
      }

      for (const issue of state.issues) {
        if (activeKeys.has(issue.key)) continue;
        if (!issue.resolvedAt) issue.resolvedAt = nowIso;
      }

      for (const issue of state.issues) {
        if (issue.resolvedAt || issue.alertSentAt) continue;
        if (ownerTargets.length === 0) continue;
        for (const owner of ownerTargets) {
          await opts.sendText(owner, issue.message);
        }
        issue.alertSentAt = nowIso;
        state.lastAlertAt = nowIso;
      }

      state.lastTickAt = nowIso;
      state.lastError = undefined;
      persistDeliveryWatchdogState(opts.watchdogFile, state);
      return summarizeDeliveryWatchdog(state, ownerTargets);
    } catch (err) {
      state.lastTickAt = nowIso;
      state.lastError = err instanceof Error ? err.message : String(err);
      persistDeliveryWatchdogState(opts.watchdogFile, state);
      throw err;
    }
  }

  return {
    start: () => {
      const timer = setInterval(() => void tick(), opts.intervalMs ?? 60_000);
      timer.unref?.();
    },
    tick,
    summary: () => summarizeDeliveryWatchdog(loadDeliveryWatchdogState(opts.watchdogFile), opts.resolveOwnerTargets()),
    state: () => loadDeliveryWatchdogState(opts.watchdogFile)
  };
}
