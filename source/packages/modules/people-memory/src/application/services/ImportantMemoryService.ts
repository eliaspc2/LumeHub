import { randomUUID } from 'node:crypto';

import type { PersonNote } from '../../domain/entities/Person.js';
import { PeopleRepository } from '../../infrastructure/persistence/PeopleRepository.js';

export class ImportantMemoryService {
  constructor(private readonly repository: PeopleRepository) {}

  async appendImportantNote(personId: string, text: string, now = new Date()): Promise<PersonNote> {
    const current = await this.repository.read();
    const note: PersonNote = {
      noteId: `note-${randomUUID()}`,
      personId,
      text: text.trim(),
      createdAt: now.toISOString(),
    };

    await this.repository.save({
      ...current,
      notes: [...current.notes, note],
    });

    return note;
  }

  async listImportantNotes(personId: string): Promise<readonly PersonNote[]> {
    return (await this.repository.read()).notes.filter((note) => note.personId === personId);
  }
}
