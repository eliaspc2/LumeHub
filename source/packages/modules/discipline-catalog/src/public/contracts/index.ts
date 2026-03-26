import type { CourseChannel, DisciplineCatalogFile, DisciplineEntry } from '../../domain/entities/DisciplineCatalog.js';

export interface DisciplineCatalogModuleContract {
  readonly moduleName: 'discipline-catalog';

  findByCode(code: string): Promise<DisciplineEntry | undefined>;
  findFromText(text: string): Promise<readonly DisciplineEntry[]>;
  listCourses(): Promise<readonly CourseChannel[]>;
  listDisciplines(): Promise<readonly DisciplineEntry[]>;
  findCourseById(courseId: string): Promise<CourseChannel | undefined>;
  listGroupsForCourse(courseId: string): Promise<readonly CourseChannel[]>;
  reload(): Promise<DisciplineCatalogFile>;
}
