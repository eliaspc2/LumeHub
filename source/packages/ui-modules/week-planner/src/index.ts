export interface WeekPlannerUiModuleConfig {
  readonly route: string;
}

export class WeekPlannerUiModule {
  constructor(readonly config: WeekPlannerUiModuleConfig = { route: '/week-planner' }) {}
}
