import type { ScheduleEvent } from '@lume-hub/schedule-events';

import type {
  NotificationRule,
  NotificationRuleDefinitionInput,
  NotificationRuleKind,
} from '../entities/NotificationRule.js';

function defaultLabelForRule(kind: NotificationRuleKind, input: NotificationRuleDefinitionInput): string | null {
  if (input.label !== undefined) {
    return input.label;
  }

  if (kind === 'relative_before_event' && input.offsetMinutesBeforeEvent) {
    if (input.offsetMinutesBeforeEvent === 1_440) {
      return '24h before';
    }

    if (input.offsetMinutesBeforeEvent === 30) {
      return '30m before';
    }

    return `${input.offsetMinutesBeforeEvent}m before`;
  }

  if (kind === 'fixed_local_time' && input.daysBeforeEvent !== undefined && input.localTime) {
    return `${input.daysBeforeEvent}d before at ${input.localTime}`;
  }

  return null;
}

function defaultRuleId(eventId: string, input: NotificationRuleDefinitionInput, index: number): string {
  if (input.ruleId) {
    return input.ruleId;
  }

  if (input.kind === 'relative_before_event') {
    return `rule-${eventId}-before-${input.offsetMinutesBeforeEvent ?? index}`;
  }

  return `rule-${eventId}-fixed-${input.daysBeforeEvent ?? 0}-${input.localTime ?? index}`;
}

export class NotificationRulePolicyEngine {
  deriveDefaults(event: ScheduleEvent): readonly NotificationRule[] {
    return this.derive(event, [
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 1_440,
      },
      {
        kind: 'relative_before_event',
        offsetMinutesBeforeEvent: 30,
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
      if (!definition.offsetMinutesBeforeEvent || definition.offsetMinutesBeforeEvent <= 0) {
        throw new Error('relative_before_event rules require a positive offsetMinutesBeforeEvent.');
      }

      return {
        ruleId: defaultRuleId(event.eventId, definition, index),
        eventId: event.eventId,
        weekId: event.weekId,
        kind: definition.kind,
        enabled: definition.enabled ?? true,
        label: defaultLabelForRule(definition.kind, definition),
        offsetMinutesBeforeEvent: definition.offsetMinutesBeforeEvent,
        daysBeforeEvent: null,
        localTime: null,
      };
    }

    if (definition.daysBeforeEvent === undefined || definition.daysBeforeEvent === null || definition.daysBeforeEvent < 0) {
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
      daysBeforeEvent: definition.daysBeforeEvent,
      localTime: definition.localTime,
    };
  }
}
