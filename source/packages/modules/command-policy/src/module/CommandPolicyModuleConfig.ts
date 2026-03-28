import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type { CommandPolicyService } from '../application/services/CommandPolicyService.js';
import type { CommandPolicySettings } from '../domain/entities/CommandPolicy.js';

export interface CommandPolicyModuleConfig {
  readonly enabled?: boolean;
  readonly settings?: Partial<CommandPolicySettings>;
  readonly settingsResolver?: () => Promise<Partial<CommandPolicySettings> | undefined> | Partial<CommandPolicySettings> | undefined;
  readonly groupDirectory?: Pick<GroupDirectoryModuleContract, 'listGroups' | 'isGroupOwner' | 'getCalendarAccessPolicy'>;
  readonly peopleMemory?: Pick<PeopleMemoryModuleContract, 'isAppOwner'>;
  readonly service?: CommandPolicyService;
}
