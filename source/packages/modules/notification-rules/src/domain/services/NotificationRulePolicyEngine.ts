import type { ScheduleEvent } from '@lume-hub/schedule-events';

import type {
  NotificationRule,
  NotificationRuleDefinitionInput,
  NotificationRuleKind,
} from '../entities/NotificationRule.js';
import {
  defaultLlmPromptTemplateForRule,
  defaultMessageTemplateForRule,
  describeNotificationRuleDefinition,
} from './ReminderPolicyToolkit.js';

function defaultLabelForRule(kind: NotificationRuleKind, input: NotificationRuleDefinitionInput): string | null {
  if (input.label !== undefined) {
    return input.label;
  }

  return describeNotificationRuleDefinition({
    kind,
    daysBeforeEvent: input.daysBeforeEvent,
    offsetMinutesBeforeEvent: input.offsetMinutesBeforeEvent,
    offsetMinutesAfterEvent: input.offsetMinutesAfterEvent,
    localTime: input.localTime,
    label: input.label,
  });
}

function defaultRuleId(eventId: string, input: NotificationRuleDefinitionInput, index: number): string {
  if (input.ruleId) {
    return input.ruleId;
  }

  if (input.kind === 'relative_before_event') {
    return `rule-${eventId}-before-${resolveRelativeOffsetMinutes(input, false) ?? index}`;
  }

  if (input.kind === 'relative_after_event') {
    return `rule-${eventId}-after-${resolveRelativeAfterOffsetMinutes(input, false) ?? index}`;
  }

  return `rule-${eventId}-fixed-${input.daysBeforeEvent ?? 0}-${input.localTime ?? index}`;
}

export class NotificationRulePolicyEngine {
  deriveDefaults(event: ScheduleEvent): readonly NotificationRule[] {
    return this.derive(event, [
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 1_440,
        label: '24h antes',
      },
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 30,
        label: '30 min antes',
      },
    ]);
  }

  derive(event: ScheduleEvent, definitions?: readonly NotificationRuleDefinitionInput[]): readonly NotificationRule[] {
    if (definitions === undefined) {
      return this.deriveDefaults(event);
    }

    return definitions.map((definition, index) => this.normalize(event, definition, index));
  }

  private normalize(
    event: ScheduleEvent,
    definition: NotificationRuleDefinitionInput,
    index: number,
  ): NotificationRule {
    if (definition.kind === 'relative_before_event') {
      const totalOffsetMinutes = resolveRelativeOffsetMinutes(definition, true);

      if (!totalOffsetMinutes || totalOffsetMinutes <= 0) {
        throw new Error('relative_before_event rules require a positive combined offset.');
      }

      return {
        ruleId: defaultRuleId(event.eventId, definition, index),
        eventId: event.eventId,
        weekId: event.weekId,
        kind: definition.kind,
        enabled: definition.enabled ?? true,
        label:
          definition.label
          ?? describeNotificationRuleDefinition({
            kind: definition.kind,
            offsetMinutesBeforeEvent: totalOffsetMinutes,
          }),
        offsetMinutesBeforeEvent: totalOffsetMinutes,
        offsetMinutesAfterEvent: null,
        daysBeforeEvent: null,
        localTime: null,
        messageTemplate: definition.messageTemplate ?? defaultMessageTemplateForRule(definition),
        llmPromptTemplate: definition.llmPromptTemplate ?? defaultLlmPromptTemplateForRule(definition),
      };
    }

    if (definition.kind === 'relative_after_event') {
      const totalOffsetMinutes = resolveRelativeAfterOffsetMinutes(definition, true);

      if (!totalOffsetMinutes || totalOffsetMinutes <= 0) {
        throw new Error('relative_after_event rules require a positive offset.');
      }

      return {
        ruleId: defaultRuleId(event.eventId, definition, index),
        eventId: event.eventId,
        weekId: event.weekId,
        kind: definition.kind,
        enabled: definition.enabled ?? true,
        label:
          definition.label
          ?? describeNotificationRuleDefinition({
            kind: definition.kind,
            offsetMinutesAfterEvent: totalOffsetMinutes,
          }),
        offsetMinutesBeforeEvent: null,
        offsetMinutesAfterEvent: totalOffsetMinutes,
        daysBeforeEvent: null,
        localTime: null,
        messageTemplate: definition.messageTemplate ?? defaultMessageTemplateForRule(definition),
        llmPromptTemplate: definition.llmPromptTemplate ?? defaultLlmPromptTemplateForRule(definition),
      };
    }

    if (
      definition.daysBeforeEvent === undefined ||
      definition.daysBeforeEvent === null ||
      definition.daysBeforeEvent < 0
    ) {
      throw new Error('fixed_local_time rules require daysBeforeEvent >= 0.');
    }

    if (!definition.localTime || !/^\d{2}:\d{2}$/u.test(definition.localTime)) {
      throw new Error('fixed_local_time rules require localTime in HH:MM format.');
    }

    return {
      ruleId: defaultRuleId(event.eventId, definition, index),
      eventId: event.eventId,
      weekId: event.weekId,
      kind: definition.kind,
      enabled: definition.enabled ?? true,
      label: defaultLabelForRule(definition.kind, definition),
      offsetMinutesBeforeEvent: null,
      offsetMinutesAfterEvent: null,
      daysBeforeEvent: definition.daysBeforeEvent,
      localTime: definition.localTime,
      messageTemplate: definition.messageTemplate ?? defaultMessageTemplateForRule(definition),
      llmPromptTemplate: definition.llmPromptTemplate ?? defaultLlmPromptTemplateForRule(definition),
    };
  }
}

function resolveRelativeOffsetMinutes(
  input: NotificationRuleDefinitionInput,
  validate = true,
): number | null {
  const daysBeforeEvent = input.daysBeforeEvent ?? 0;
  const offsetMinutesBeforeEvent = input.offsetMinutesBeforeEvent ?? 0;

  if (!validate) {
    if (daysBeforeEvent < 0 || offsetMinutesBeforeEvent < 0) {
      return null;
    }

    return (daysBeforeEvent * 1_440) + offsetMinutesBeforeEvent;
  }

  if (!Number.isInteger(daysBeforeEvent) || daysBeforeEvent < 0) {
    throw new Error('relative_before_event rules require daysBeforeEvent >= 0 when provided.');
  }

  if (!Number.isInteger(offsetMinutesBeforeEvent) || offsetMinutesBeforeEvent < 0) {
    throw new Error('relative_before_event rules require offsetMinutesBeforeEvent >= 0 when provided.');
  }

  return (daysBeforeEvent * 1_440) + offsetMinutesBeforeEvent;
}

function resolveRelativeAfterOffsetMinutes(
  input: NotificationRuleDefinitionInput,
  validate = true,
): number | null {
  const offsetMinutesAfterEvent = input.offsetMinutesAfterEvent ?? 0;

  if (!validate) {
    return offsetMinutesAfterEvent >= 0 ? offsetMinutesAfterEvent : null;
  }

  if (!Number.isInteger(offsetMinutesAfterEvent) || offsetMinutesAfterEvent < 0) {
    throw new Error('relative_after_event rules require offsetMinutesAfterEvent >= 0 when provided.');
  }

  return offsetMinutesAfterEvent;
}
