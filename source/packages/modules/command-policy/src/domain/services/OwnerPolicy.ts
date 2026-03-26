import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

export class OwnerPolicy {
  constructor(
    private readonly peopleMemory: Pick<PeopleMemoryModuleContract, 'isAppOwner'>,
    private readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'listGroups' | 'isGroupOwner'>,
  ) {}

  async isAppOwner(personId: string | null): Promise<boolean> {
    return personId ? this.peopleMemory.isAppOwner(personId) : false;
  }

  async listOwnedGroups(personId: string | null): Promise<readonly string[]> {
    if (!personId) {
      return [];
    }

    const groups = await this.groupDirectory.listGroups();
    const ownedGroupJids: string[] = [];

    for (const group of groups) {
      if (await this.groupDirectory.isGroupOwner(group.groupJid, personId)) {
        ownedGroupJids.push(group.groupJid);
      }
    }

    return ownedGroupJids.sort((left, right) => left.localeCompare(right));
  }
}
