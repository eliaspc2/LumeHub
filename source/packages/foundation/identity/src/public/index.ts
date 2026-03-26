export interface IdentityRecord {
  readonly id: string;
  readonly source: string;
}

export class IdentityMap {
  private readonly records = new Map<string, IdentityRecord>();

  register(record: IdentityRecord): void {
    this.records.set(record.id, record);
  }

  get(id: string): IdentityRecord | undefined {
    return this.records.get(id);
  }
}
