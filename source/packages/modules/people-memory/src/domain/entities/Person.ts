export interface PersonIdentifier {
  readonly kind: string;
  readonly value: string;
}

export type PersonRole = 'app_owner' | 'member';

export interface Person {
  readonly personId: string;
  readonly displayName: string;
  readonly identifiers: readonly PersonIdentifier[];
  readonly globalRoles: readonly PersonRole[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersonNote {
  readonly noteId: string;
  readonly personId: string;
  readonly text: string;
  readonly createdAt: string;
}

export interface PeopleMemoryFile {
  readonly schemaVersion: 1;
  readonly people: readonly Person[];
  readonly notes: readonly PersonNote[];
}

export interface PersonUpsertInput {
  readonly personId?: string;
  readonly displayName: string;
  readonly identifiers: readonly PersonIdentifier[];
  readonly globalRoles?: readonly PersonRole[];
}
