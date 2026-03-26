import type { Person, PersonIdentifier, PersonNote, PersonUpsertInput } from '../../domain/entities/Person.js';

export interface PeopleMemoryModuleContract {
  readonly moduleName: 'people-memory';

  listPeople(): Promise<readonly Person[]>;
  findPersonById(personId: string): Promise<Person | undefined>;
  findByIdentifiers(identifiers: readonly PersonIdentifier[]): Promise<Person | undefined>;
  upsertByIdentifiers(input: PersonUpsertInput): Promise<Person>;
  appendImportantNote(personId: string, text: string): Promise<PersonNote>;
  listImportantNotes(personId: string): Promise<readonly PersonNote[]>;
  isAppOwner(personId: string): Promise<boolean>;
}
