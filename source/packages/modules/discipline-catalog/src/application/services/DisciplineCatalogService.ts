import type { CourseChannel, DisciplineCatalogFile, DisciplineEntry } from '../../domain/entities/DisciplineCatalog.js';
import { DisciplineCatalogLoader } from '../../infrastructure/persistence/DisciplineCatalogLoader.js';

export class DisciplineCatalogService {
  private catalogPromise?: Promise<DisciplineCatalogFile>;

  constructor(private readonly loader: DisciplineCatalogLoader) {}

  async findByCode(code: string): Promise<DisciplineEntry | undefined> {
    const normalisedCode = normaliseKey(code);
    return (await this.getCatalog()).disciplines.find((discipline) => normaliseKey(discipline.code) === normalisedCode);
  }

  async findFromText(text: string): Promise<readonly DisciplineEntry[]> {
    const normalisedText = normaliseText(text);
    const catalog = await this.getCatalog();

    return catalog.disciplines.filter((discipline) => {
      if (normalisedText.includes(normaliseKey(discipline.code))) {
        return true;
      }

      if (normalisedText.includes(normaliseKey(discipline.title))) {
        return true;
      }

      if (discipline.aliases.some((alias) => normalisedText.includes(normaliseKey(alias)))) {
        return true;
      }

      const course = catalog.courses.find((candidate) => candidate.courseId === discipline.courseId);
      return course ? normalisedText.includes(normaliseKey(course.title)) : false;
    });
  }

  async listCourses(): Promise<readonly CourseChannel[]> {
    return (await this.getCatalog()).courses;
  }

  async listDisciplines(): Promise<readonly DisciplineEntry[]> {
    return (await this.getCatalog()).disciplines;
  }

  async findCourseById(courseId: string): Promise<CourseChannel | undefined> {
    const normalisedCourseId = normaliseKey(courseId);
    return (await this.getCatalog()).courses.find((course) => normaliseKey(course.courseId) === normalisedCourseId);
  }

  async listGroupsForCourse(courseId: string): Promise<readonly CourseChannel[]> {
    const normalisedCourseId = normaliseKey(courseId);
    return (await this.getCatalog()).courses.filter((course) => normaliseKey(course.courseId) === normalisedCourseId);
  }

  async reload(): Promise<DisciplineCatalogFile> {
    this.catalogPromise = undefined;
    return this.getCatalog();
  }

  private async getCatalog(): Promise<DisciplineCatalogFile> {
    this.catalogPromise ??= this.loader.load();
    return this.catalogPromise;
  }
}

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}

function normaliseText(value: string): string {
  return value.trim().toLowerCase();
}
