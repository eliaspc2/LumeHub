import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type { OwnerScopeResolution } from '../entities/OwnerControl.js';

export class OwnerScopeAuthorizer {
  constructor(
    private readonly peopleMemory: Pick<PeopleMemoryModuleContract, 'isAppOwner'>,
    private readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'listGroups' | 'isGroupOwner'>,
  ) {}

  async resolve(personId: string | null): Promise<OwnerScopeResolution> {
    if (!personId) {
      return {
        scope: 'none',
        personId,
        allowedGroupJids: [],
      };
    }

    if (await this.peopleMemory.isAppOwner(personId)) {
      return {
        scope: 'app_owner',
        personId,
        allowedGroupJids: (await this.groupDirectory.listGroups()).map((group) => group.groupJid),
      };
    }

    const allowedGroupJids: string[] = [];

    for (const group of await this.groupDirectory.listGroups()) {
      if (await this.groupDirectory.isGroupOwner(group.groupJid, personId)) {
        allowedGroupJids.push(group.groupJid);
      }
    }

    return {
      scope: allowedGroupJids.length > 0 ? 'group_owner' : 'none',
      personId,
      allowedGroupJids: allowedGroupJids.sort((left, right) => left.localeCompare(right)),
    };
  }
}
