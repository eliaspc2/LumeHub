export interface DispatchJobResult {
  readonly jobId: string;
  readonly status: 'prepared' | 'skipped' | 'waiting_confirmation_reviewed';
  readonly reason?: string;
  readonly instructionId?: string;
}

export interface DispatchTickResult {
  readonly tickStartedAt: string;
  readonly tickFinishedAt: string;
  readonly dueJobsScanned: number;
  readonly waitingConfirmationReviewed: number;
  readonly results: readonly DispatchJobResult[];
}
