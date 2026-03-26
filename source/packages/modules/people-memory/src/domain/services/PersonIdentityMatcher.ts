import type { PersonIdentifier } from '../entities/Person.js';

export class PersonIdentityMatcher {
  identifiersMatch(
    left: readonly PersonIdentifier[],
    right: readonly PersonIdentifier[],
  ): boolean {
    return left.some((candidate) =>
      right.some(
        (other) => normaliseKey(candidate.kind) === normaliseKey(other.kind) && normaliseKey(candidate.value) === normaliseKey(other.value),
      ),
    );
  }

  normaliseIdentifiers(identifiers: readonly PersonIdentifier[]): readonly PersonIdentifier[] {
    const entries = new Map<string, PersonIdentifier>();

    for (const identifier of identifiers) {
      const normalised: PersonIdentifier = {
        kind: identifier.kind.trim(),
        value: identifier.value.trim(),
      };
      entries.set(`${normaliseKey(normalised.kind)}:${normaliseKey(normalised.value)}`, normalised);
    }

    return [...entries.values()];
  }
}

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}
