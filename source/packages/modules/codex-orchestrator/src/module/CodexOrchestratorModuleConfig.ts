import type { AdminConfigModuleContract } from '@lume-hub/admin-config';
import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';
import type { ScheduleEventsModuleContract } from '@lume-hub/schedule-events';

import type { ResolveCodexOrchestratorPathsInput } from '../application/services/CodexOrchestratorPaths.js';
import type { CodexOrchestratorService } from '../application/services/CodexOrchestratorService.js';

export interface CodexOrchestratorModuleConfig extends ResolveCodexOrchestratorPathsInput {
  readonly service?: CodexOrchestratorService;
  readonly adminConfig?: AdminConfigModuleContract;
  readonly peopleMemory?: PeopleMemoryModuleContract;
  readonly groupDirectory?: GroupDirectoryModuleContract;
  readonly scheduleEvents?: ScheduleEventsModuleContract;
}
