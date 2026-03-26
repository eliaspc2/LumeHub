import type { NotificationJob } from '@lume-hub/notification-jobs';

export class DispatchMessageFormatter {
  format(job: NotificationJob): string {
    return `Lembrete: ${job.title} em ${job.eventAt}.`;
  }
}
