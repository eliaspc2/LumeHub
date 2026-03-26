import type { GroupMetadataRecord } from './types.js';

export class GroupMetadataCache {
  private readonly cache = new Map<string, GroupMetadataRecord>();

  set(record: GroupMetadataRecord): void {
    this.cache.set(record.groupJid, record);
  }

  get(groupJid: string): GroupMetadataRecord | undefined {
    return this.cache.get(groupJid);
  }

  entries(): readonly GroupMetadataRecord[] {
    return [...this.cache.values()].sort((left, right) => left.groupJid.localeCompare(right.groupJid));
  }
}
