import type { NotificationRuleDefinitionInput } from '../entities/NotificationRule.js';

export interface GroupReminderPolicy {
  readonly schemaVersion: 1;
  readonly enabled: boolean;
  readonly reminders: readonly NotificationRuleDefinitionInput[];
}

export interface ReminderTemplateContext {
  readonly groupLabel: string;
  readonly eventTitle: string;
  readonly eventAt: string;
  readonly sendAt: string;
  readonly timeZone?: string | null;
  readonly reminderLabel?: string | null;
}

export interface ReminderTemplateVariableDescriptor {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly example: string;
}

const DEFAULT_TIME_ZONE = 'Europe/Lisbon';

export function createDefaultGroupReminderPolicy(): GroupReminderPolicy {
  return {
    schemaVersion: 1,
    enabled: true,
    reminders: createDefaultGroupReminderDefinitions(),
  };
}

export function createDefaultGroupReminderDefinitions(): readonly NotificationRuleDefinitionInput[] {
  return [
    {
      kind: 'relative_before_event',
      daysBeforeEvent: 1,
      offsetMinutesBeforeEvent: 0,
      enabled: true,
      label: '24h antes',
      messageTemplate: 'Daqui a {{hours_until_event}} hora(s) temos {{event_title}}.',
      llmPromptTemplate:
        'Escreve uma mensagem curta em portugues europeu para WhatsApp. Contexto: daqui a {{hours_until_event}} horas temos {{event_title}} em {{event_datetime}} para o grupo {{group_label}}.',
    },
    {
      kind: 'relative_before_event',
      daysBeforeEvent: 0,
      offsetMinutesBeforeEvent: 30,
      enabled: true,
      label: '30 min antes',
      messageTemplate: 'Daqui a {{minutes_until_event}} min temos {{event_title}}.',
      llmPromptTemplate:
        'Escreve um ultimo lembrete curto em portugues europeu para WhatsApp. Contexto: faltam {{minutes_until_event}} minutos para {{event_title}} em {{event_datetime}} no grupo {{group_label}}.',
    },
  ];
}

export function describeNotificationRuleDefinition(
  definition: Pick<
    NotificationRuleDefinitionInput,
    'kind' | 'label' | 'daysBeforeEvent' | 'offsetMinutesBeforeEvent' | 'offsetMinutesAfterEvent' | 'localTime'
  >,
): string {
  if (definition.label && definition.label.trim().length > 0) {
    return definition.label.trim();
  }

  if (definition.kind === 'relative_before_event') {
    return describeRelativeMinutes(definition.offsetMinutesBeforeEvent ?? 0, 'antes');
  }

  if (definition.kind === 'relative_after_event') {
    return describeRelativeMinutes(definition.offsetMinutesAfterEvent ?? 0, 'depois');
  }

  if ((definition.daysBeforeEvent ?? 0) >= 1) {
    return `dia anterior as ${definition.localTime ?? '00:00'}`;
  }

  return `no proprio dia as ${definition.localTime ?? '00:00'}`;
}

export function defaultMessageTemplateForRule(definition: NotificationRuleDefinitionInput): string {
  if (definition.kind === 'relative_after_event') {
    return 'Ja passou {{minutes_since_event}} min desde {{event_title}}.';
  }

  if (definition.kind === 'fixed_local_time' && (definition.daysBeforeEvent ?? 0) >= 1) {
    return 'Amanha temos {{event_title}} as {{event_time}}.';
  }

  if (definition.kind === 'fixed_local_time') {
    return 'Hoje temos {{event_title}} as {{event_time}}.';
  }

  return 'Daqui a {{minutes_until_event}} min temos {{event_title}}.';
}

export function defaultLlmPromptTemplateForRule(definition: NotificationRuleDefinitionInput): string {
  if (definition.kind === 'relative_after_event') {
    return 'Escreve uma mensagem curta em portugues europeu para WhatsApp. Contexto: ja passaram {{minutes_since_event}} minutos desde {{event_title}} em {{event_datetime}} para o grupo {{group_label}}.';
  }

  if (definition.kind === 'fixed_local_time' && (definition.daysBeforeEvent ?? 0) >= 1) {
    return 'Escreve um lembrete curto em portugues europeu para WhatsApp. Contexto: amanha o grupo {{group_label}} tem {{event_title}} as {{event_time}}.';
  }

  if (definition.kind === 'fixed_local_time') {
    return 'Escreve um lembrete curto em portugues europeu para WhatsApp. Contexto: hoje o grupo {{group_label}} tem {{event_title}} as {{event_time}}.';
  }

  return 'Escreve uma mensagem curta em portugues europeu para WhatsApp. Contexto: faltam {{minutes_until_event}} minutos para {{event_title}} em {{event_datetime}} no grupo {{group_label}}.';
}

export function renderReminderTemplate(
  template: string | null | undefined,
  variables: Record<string, string | number>,
): string {
  return (template ?? '')
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gu, (_match, key) => String(variables[key] ?? ''))
    .trim();
}

export function buildReminderTemplateVariables(
  context: ReminderTemplateContext,
): Record<string, string | number> {
  const eventAt = new Date(context.eventAt);
  const sendAt = new Date(context.sendAt);
  const diffMinutes = Number.isFinite(eventAt.getTime()) && Number.isFinite(sendAt.getTime())
    ? Math.round((eventAt.getTime() - sendAt.getTime()) / 60_000)
    : 0;
  const minutesUntilEvent = Math.max(diffMinutes, 0);
  const minutesSinceEvent = Math.max(-diffMinutes, 0);
  const timeZone = context.timeZone ?? DEFAULT_TIME_ZONE;

  return {
    group_label: context.groupLabel,
    event_title: context.eventTitle,
    event_date: formatDateToken(eventAt, timeZone),
    event_time: formatTimeToken(eventAt, timeZone),
    event_datetime: formatDateTimeToken(eventAt, timeZone),
    send_date: formatDateToken(sendAt, timeZone),
    send_time: formatTimeToken(sendAt, timeZone),
    send_datetime: formatDateTimeToken(sendAt, timeZone),
    reminder_label: context.reminderLabel ?? '',
    minutes_until_event: minutesUntilEvent,
    hours_until_event: formatHours(minutesUntilEvent),
    minutes_since_event: minutesSinceEvent,
    hours_since_event: formatHours(minutesSinceEvent),
  };
}

export function buildReminderTemplateVariableCatalog(
  context: ReminderTemplateContext,
): readonly ReminderTemplateVariableDescriptor[] {
  const variables = buildReminderTemplateVariables(context);

  return [
    {
      key: 'group_label',
      label: 'Grupo',
      description: 'Nome humano do grupo.',
      example: String(variables.group_label),
    },
    {
      key: 'event_title',
      label: 'Evento',
      description: 'Titulo do evento ou aula.',
      example: String(variables.event_title),
    },
    {
      key: 'event_date',
      label: 'Data do evento',
      description: 'Data local do evento.',
      example: String(variables.event_date),
    },
    {
      key: 'event_time',
      label: 'Hora do evento',
      description: 'Hora local do evento.',
      example: String(variables.event_time),
    },
    {
      key: 'event_datetime',
      label: 'Data e hora do evento',
      description: 'Data e hora local do evento.',
      example: String(variables.event_datetime),
    },
    {
      key: 'minutes_until_event',
      label: 'Minutos ate ao evento',
      description: 'Valor util para lembretes antes do evento.',
      example: String(variables.minutes_until_event),
    },
    {
      key: 'hours_until_event',
      label: 'Horas ate ao evento',
      description: 'Versao em horas do intervalo antes do evento.',
      example: String(variables.hours_until_event),
    },
    {
      key: 'minutes_since_event',
      label: 'Minutos depois do evento',
      description: 'Valor util para seguimentos depois do evento.',
      example: String(variables.minutes_since_event),
    },
    {
      key: 'hours_since_event',
      label: 'Horas depois do evento',
      description: 'Versao em horas do intervalo depois do evento.',
      example: String(variables.hours_since_event),
    },
  ];
}

export function extractGroupReminderPolicy(value: unknown): GroupReminderPolicy {
  const root = isRecord(value) ? value : {};
  const reminderBlock = isRecord(root.reminders) ? root.reminders : {};
  const enabled = reminderBlock.enabled === undefined ? true : Boolean(reminderBlock.enabled);
  const rawReminders = Array.isArray(reminderBlock.reminders) ? reminderBlock.reminders : [];

  return {
    schemaVersion: 1,
    enabled,
    reminders: rawReminders
      .map((entry) => normalizeReminderDefinition(entry))
      .filter((entry): entry is NotificationRuleDefinitionInput => entry !== null),
  };
}

export function hasStoredGroupReminderPolicy(value: unknown): boolean {
  const root = isRecord(value) ? value : {};
  return isRecord(root.reminders);
}

export function applyGroupReminderPolicyToDocument(
  existing: Record<string, unknown> | null,
  policy: GroupReminderPolicy,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    reminders: {
      schemaVersion: 1,
      enabled: policy.enabled,
      reminders: policy.reminders.map((reminder) => ({
        kind: reminder.kind,
        ruleId: reminder.ruleId ?? null,
        enabled: reminder.enabled ?? true,
        label: reminder.label ?? null,
        daysBeforeEvent: reminder.daysBeforeEvent ?? null,
        offsetMinutesBeforeEvent: reminder.offsetMinutesBeforeEvent ?? null,
        offsetMinutesAfterEvent: reminder.offsetMinutesAfterEvent ?? null,
        localTime: reminder.localTime ?? null,
        messageTemplate: reminder.messageTemplate ?? defaultMessageTemplateForRule(reminder),
        llmPromptTemplate: reminder.llmPromptTemplate ?? defaultLlmPromptTemplateForRule(reminder),
      })),
    },
  };
}

export function groupReminderPolicyToNotificationRules(
  policy: GroupReminderPolicy | null | undefined,
): readonly NotificationRuleDefinitionInput[] {
  if (!policy || !policy.enabled) {
    return [];
  }

  return policy.reminders;
}

function describeRelativeMinutes(totalMinutes: number, suffix: 'antes' | 'depois'): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return `sem regra ${suffix}`;
  }

  if (totalMinutes % 1_440 === 0) {
    const days = totalMinutes / 1_440;
    return days === 1 ? `24h ${suffix}` : `${days} dia(s) ${suffix}`;
  }

  if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
    return `${totalMinutes / 60}h ${suffix}`;
  }

  return `${totalMinutes} min ${suffix}`;
}

function formatHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0';
  }

  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatDateToken(value: Date, timeZone: string): string {
  if (!Number.isFinite(value.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-PT', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

function formatTimeToken(value: Date, timeZone: string): string {
  if (!Number.isFinite(value.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-PT', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

function formatDateTimeToken(value: Date, timeZone: string): string {
  const date = formatDateToken(value, timeZone);
  const time = formatTimeToken(value, timeZone);
  return date && time ? `${date}, ${time}` : '';
}

function normalizeReminderDefinition(value: unknown): NotificationRuleDefinitionInput | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return null;
  }

  if (
    value.kind !== 'relative_before_event' &&
    value.kind !== 'fixed_local_time' &&
    value.kind !== 'relative_after_event'
  ) {
    return null;
  }

  return {
    ruleId: readOptionalString(value.ruleId) ?? undefined,
    kind: value.kind,
    enabled: value.enabled === undefined ? true : Boolean(value.enabled),
    label: readOptionalString(value.label),
    daysBeforeEvent: readOptionalInteger(value.daysBeforeEvent),
    offsetMinutesBeforeEvent: readOptionalInteger(value.offsetMinutesBeforeEvent),
    offsetMinutesAfterEvent: readOptionalInteger(value.offsetMinutesAfterEvent),
    localTime: readOptionalString(value.localTime),
    messageTemplate: readOptionalString(value.messageTemplate) ?? defaultMessageTemplateForRule({
      kind: value.kind,
      daysBeforeEvent: readOptionalInteger(value.daysBeforeEvent),
    }),
    llmPromptTemplate: readOptionalString(value.llmPromptTemplate) ?? defaultLlmPromptTemplateForRule({
      kind: value.kind,
      daysBeforeEvent: readOptionalInteger(value.daysBeforeEvent),
    }),
  };
}

function readOptionalInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
