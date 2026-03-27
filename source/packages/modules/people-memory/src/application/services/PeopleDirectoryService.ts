import { randomUUID } from 'node:crypto';

import type { Person, PersonIdentifier, PersonRole, PersonUpsertInput } from '../../domain/entities/Person.js';
import { PersonIdentityMatcher } from '../../domain/services/PersonIdentityMatcher.js';
import { PeopleRepository } from '../../infrastructure/persistence/PeopleRepository.js';

export class PeopleDirectoryService {
  constructor(
    private readonly repository: PeopleRepository,
    private readonly matcher = new PersonIdentityMatcher(),
  ) {}

  async listPeople(): Promise<readonly Person[]> {
    return (await this.repository.read()).people;
  }

  async findPersonById(personId: string): Promise<Person | undefined> {
    return (await this.listPeople()).find((person) => person.personId === personId);
  }

  async findByIdentifiers(identifiers: readonly PersonIdentifier[]): Promise<Person | undefined> {
    const normalisedIdentifiers = this.matcher.normaliseIdentifiers(identifiers);
    return (await this.listPeople()).find((person) => this.matcher.identifiersMatch(person.identifiers, normalisedIdentifiers));
  }

  async upsertByIdentifiers(input: PersonUpsertInput, now = new Date()): Promise<Person> {
    const current = await this.repository.read();
    const normalisedIdentifiers = this.matcher.normaliseIdentifiers(input.identifiers);
    const existing =
      (input.personId ? current.people.find((person) => person.personId === input.personId) : undefined) ??
      current.people.find((person) => this.matcher.identifiersMatch(person.identifiers, normalisedIdentifiers));

    const nextPerson: Person = {
      personId: existing?.personId ?? input.personId ?? `person-${randomUUID()}`,
      displayName: input.displayName.trim(),
      identifiers: this.matcher.normaliseIdentifiers([...(existing?.identifiers ?? []), ...normalisedIdentifiers]),
      globalRoles: dedupeRoles([...(existing?.globalRoles ?? ['member']), ...(input.globalRoles ?? [])]),
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const nextPeople = existing
      ? current.people.map((person) => (person.personId === existing.personId ? nextPerson : person))
      : [...current.people, nextPerson];

    await this.repository.save({
      ...current,
      people: nextPeople,
    });

    return nextPerson;
  }

  async updatePersonRoles(personId: string, globalRoles: readonly PersonRole[], now = new Date()): Promise<Person> {
    const current = await this.repository.read();
    const existing = current.people.find((person) => person.personId === personId);

    if (!existing) {
      throw new Error(`Unknown person '${personId}'.`);
    }

    const nextPerson: Person = {
      ...existing,
      globalRoles: dedupeRoles(globalRoles),
      updatedAt: now.toISOString(),
    };

    await this.repository.save({
      ...current,
      people: current.people.map((person) => (person.personId === personId ? nextPerson : person)),
    });

    return nextPerson;
  }

  async isAppOwner(personId: string): Promise<boolean> {
    return (await this.findPersonById(personId))?.globalRoles.includes('app_owner') ?? false;
  }
}

function dedupeRoles(roles: readonly PersonRole[]): readonly PersonRole[] {
  return [...new Set<PersonRole>(roles.length > 0 ? [...roles] : ['member'])];
}
