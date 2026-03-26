import type { CalendarAccessMode, GroupDirectoryModuleContract } from '@lume-hub/group-directory';

import { OwnerPolicy } from './OwnerPolicy.js';

export class CalendarAccessAuthorizer {
  constructor(
    private readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'getCalendarAccessPolicy' | 'isGroupOwner'>,
    private readonly ownerPolicy: OwnerPolicy,
  ) {}

  async getCalendarAccessMode(groupJid: string, personId: string | null): Promise<CalendarAccessMode> {
    const policy = await this.groupDirectory.getCalendarAccessPolicy(groupJid);

    if (await this.ownerPolicy.isAppOwner(personId)) {
      return policy.appOwner;
    }

    if (personId && (await this.groupDirectory.isGroupOwner(groupJid, personId))) {
      return policy.groupOwner;
    }

    return policy.group;
  }

  async canManageCalendar(
    groupJid: string,
    personId: string | null,
    requiredMode: CalendarAccessMode,
  ): Promise<boolean> {
    const accessMode = await this.getCalendarAccessMode(groupJid, personId);
    return requiredMode === 'read' ? accessMode === 'read' || accessMode === 'read_write' : accessMode === 'read_write';
  }
}
