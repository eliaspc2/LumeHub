export interface CourseChannel {
  readonly courseId: string;
  readonly title: string;
  readonly groupJid: string;
  readonly preferredSubject: string;
  readonly aliases: readonly string[];
}

export interface DisciplineEntry {
  readonly code: string;
  readonly title: string;
  readonly courseId: string;
  readonly aliases: readonly string[];
}

export interface DisciplineCatalogFile {
  readonly schemaVersion: 1;
  readonly courses: readonly CourseChannel[];
  readonly disciplines: readonly DisciplineEntry[];
}
