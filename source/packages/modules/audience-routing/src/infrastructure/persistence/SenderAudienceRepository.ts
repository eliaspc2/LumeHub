import { readFile } from 'node:fs/promises';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

import type { SenderAudienceRoutingFile, SenderAudienceRule } from '../../domain/entities/AudienceRouting.js';

const EMPTY_AUDIENCE_ROUTING_FILE: SenderAudienceRoutingFile = {
  schemaVersion: 1,
  rules: [],
};

export interface SenderAudienceRepositoryConfig {
  readonly rulesFilePath?: string;
}

export class SenderAudienceRepository {
  constructor(
    private readonly config: SenderAudienceRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  async read(): Promise<SenderAudienceRoutingFile> {
    if (!this.config.rulesFilePath) {
      return EMPTY_AUDIENCE_ROUTING_FILE;
    }

    try {
      return normaliseFile(JSON.parse(await readFile(this.config.rulesFilePath, 'utf8')) as SenderAudienceRoutingFile);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_AUDIENCE_ROUTING_FILE;
      }

      throw error;
    }
  }

  async listRules(): Promise<readonly SenderAudienceRule[]> {
    return (await this.read()).rules;
  }

  async save(value: SenderAudienceRoutingFile): Promise<SenderAudienceRoutingFile> {
    const nextValue = normaliseFile(value);

    if (!this.config.rulesFilePath) {
      return nextValue;
    }

    await this.writer.write(this.config.rulesFilePath, nextValue);
    return nextValue;
  }
}

function normaliseFile(value: SenderAudienceRoutingFile): SenderAudienceRoutingFile {
  return {
    schemaVersion: 1,
    rules: value.rules.map((rule) => ({
      ruleId: rule.ruleId.trim(),
      personId: rule.personId?.trim() || null,
      identifiers: dedupeIdentifiers(rule.identifiers ?? []),
      targetGroupJids: dedupeStrings(rule.targetGroupJids ?? []),
      targetCourseIds: dedupeStrings(rule.targetCourseIds ?? []),
      targetDisciplineCodes: dedupeStrings(rule.targetDisciplineCodes ?? []),
      enabled: rule.enabled ?? true,
      requiresConfirmation: rule.requiresConfirmation ?? false,
      notes: rule.notes?.trim() || null,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    })),
  };
}

function dedupeIdentifiers(
  identifiers: readonly { kind: string; value: string }[],
): readonly { kind: string; value: string }[] {
  const values = new Map<string, { kind: string; value: string }>();

  for (const identifier of identifiers) {
    const normalised = {
      kind: identifier.kind.trim(),
      value: identifier.value.trim(),
    };

    if (!normalised.kind || !normalised.value) {
      continue;
    }

    values.set(`${normaliseKey(normalised.kind)}:${normaliseKey(normalised.value)}`, normalised);
  }

  return [...values.values()];
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}
