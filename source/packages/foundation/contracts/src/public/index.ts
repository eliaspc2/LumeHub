export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type WeekId = Brand<string, 'WeekId'>;
export type GroupId = Brand<string, 'GroupId'>;
export type PersonId = Brand<string, 'PersonId'>;
export type EventId = Brand<string, 'EventId'>;
export type NotificationJobId = Brand<string, 'NotificationJobId'>;
export type InstructionId = Brand<string, 'InstructionId'>;
export type DeliveryAttemptId = Brand<string, 'DeliveryAttemptId'>;

export interface ModuleHealth {
  readonly status: 'starting' | 'healthy' | 'degraded' | 'stopped';
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
}
