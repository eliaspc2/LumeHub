import type { GroupCalendarEventRecord } from '@lume-hub/persistence-group-files';

export class PastEventCleanupPolicy {
  shouldArchiveEvent(event: GroupCalendarEventRecord, now: Date): boolean {
    if (new Date(event.eventAt).getTime() > now.getTime()) {
      return false;
    }

    return event.notifications.every(
      (notification) =>
        notification.status === 'sent' ||
        Boolean(notification.suppressedAt) ||
        Boolean(notification.disabledAt),
    );
  }
}
