import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AtomicJsonWriter } from '@lume-hub/persistence-group-files';

export type ConversationReplyDeliveryState = 'armed' | 'accepted' | 'observed' | 'confirmed' | 'failed';

export interface ConversationReplyDeliveryRecord {
  readonly replyId: string;
  readonly sourceMessageId: string;
  readonly sourceChatJid: string;
  readonly sourceChatType: 'group' | 'private';
  readonly sourceGroupJid: string | null;
  readonly sourcePersonId: string | null;
  readonly targetChatJid: string;
  readonly targetChatType: 'group' | 'private';
  readonly replyText: string;
  readonly state: ConversationReplyDeliveryState;
  readonly reason: string | null;
  readonly outboundMessageId: string | null;
  readonly armedAt: string;
  readonly acceptedAt: string | null;
  readonly observedAt: string | null;
  readonly confirmedAt: string | null;
  readonly failedAt: string | null;
  readonly ack: number | null;
  readonly lastError: string | null;
  readonly updatedAt: string;
}

export interface ConversationReplyDeliveryFile {
  readonly schemaVersion: 1;
  readonly entries: readonly ConversationReplyDeliveryRecord[];
}

export interface ConversationReplyDeliveryRepositoryConfig {
  readonly dataRootPath?: string;
  readonly filePath?: string;
}

const EMPTY_FILE: ConversationReplyDeliveryFile = {
  schemaVersion: 1,
  entries: [],
};

export class ConversationReplyDeliveryRepository {
  constructor(
    private readonly config: ConversationReplyDeliveryRepositoryConfig = {},
    private readonly writer = new AtomicJsonWriter(),
  ) {}

  resolveFilePath(): string {
    return this.config.filePath ?? join(this.config.dataRootPath ?? 'data', 'runtime', 'conversation-reply-deliveries.json');
  }

  async read(): Promise<ConversationReplyDeliveryFile> {
    try {
      return normaliseFile(JSON.parse(await readFile(this.resolveFilePath(), 'utf8')) as ConversationReplyDeliveryFile);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return EMPTY_FILE;
      }

      throw error;
    }
  }

  async listRecent(limit = 20): Promise<readonly ConversationReplyDeliveryRecord[]> {
    const file = await this.read();
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
    return file.entries.slice(Math.max(0, file.entries.length - safeLimit)).reverse();
  }

  async markArmed(
    input: Omit<
      ConversationReplyDeliveryRecord,
      'state' | 'outboundMessageId' | 'acceptedAt' | 'observedAt' | 'confirmedAt' | 'failedAt' | 'ack' | 'lastError' | 'updatedAt'
    >,
  ): Promise<ConversationReplyDeliveryRecord> {
    const file = await this.read();
    const record: ConversationReplyDeliveryRecord = normaliseEntry({
      ...input,
      state: 'armed',
      outboundMessageId: null,
      acceptedAt: null,
      observedAt: null,
      confirmedAt: null,
      failedAt: null,
      ack: null,
      lastError: null,
      updatedAt: input.armedAt,
    });
    await this.write({
      schemaVersion: 1,
      entries: [...file.entries, record],
    });
    return record;
  }

  async markAccepted(
    replyId: string,
    input: {
      readonly outboundMessageId: string;
      readonly acceptedAt: string;
    },
  ): Promise<ConversationReplyDeliveryRecord | undefined> {
    return this.updateEntry(
      (entry) => entry.replyId === replyId,
      (entry) => ({
        ...entry,
        state: 'accepted',
        outboundMessageId: input.outboundMessageId,
        acceptedAt: input.acceptedAt,
        updatedAt: input.acceptedAt,
      }),
    );
  }

  async markObservedByOutboundMessageId(
    outboundMessageId: string,
    input: {
      readonly observedAt: string;
    },
  ): Promise<ConversationReplyDeliveryRecord | undefined> {
    return this.updateEntry(
      (entry) => entry.outboundMessageId === outboundMessageId,
      (entry) => ({
        ...entry,
        state: entry.confirmedAt ? 'confirmed' : 'observed',
        observedAt: entry.observedAt ?? input.observedAt,
        updatedAt: input.observedAt,
      }),
    );
  }

  async markConfirmedByOutboundMessageId(
    outboundMessageId: string,
    input: {
      readonly confirmedAt: string;
      readonly ack: number;
    },
  ): Promise<ConversationReplyDeliveryRecord | undefined> {
    return this.updateEntry(
      (entry) => entry.outboundMessageId === outboundMessageId,
      (entry) => ({
        ...entry,
        state: 'confirmed',
        observedAt: entry.observedAt ?? input.confirmedAt,
        confirmedAt: input.confirmedAt,
        ack: input.ack,
        updatedAt: input.confirmedAt,
      }),
    );
  }

  async markFailed(
    replyId: string,
    input: {
      readonly failedAt: string;
      readonly error: string;
    },
  ): Promise<ConversationReplyDeliveryRecord | undefined> {
    return this.updateEntry(
      (entry) => entry.replyId === replyId,
      (entry) => ({
        ...entry,
        state: 'failed',
        failedAt: input.failedAt,
        lastError: input.error,
        updatedAt: input.failedAt,
      }),
    );
  }

  async getSummary(): Promise<{
    readonly armed: number;
    readonly accepted: number;
    readonly observed: number;
    readonly confirmed: number;
    readonly failed: number;
  }> {
    const file = await this.read();
    return file.entries.reduce(
      (summary, entry) => ({
        ...summary,
        [entry.state]: summary[entry.state] + 1,
      }),
      {
        armed: 0,
        accepted: 0,
        observed: 0,
        confirmed: 0,
        failed: 0,
      },
    );
  }

  private async updateEntry(
    predicate: (entry: ConversationReplyDeliveryRecord) => boolean,
    updater: (entry: ConversationReplyDeliveryRecord) => ConversationReplyDeliveryRecord,
  ): Promise<ConversationReplyDeliveryRecord | undefined> {
    const file = await this.read();
    const index = file.entries.findIndex(predicate);

    if (index < 0) {
      return undefined;
    }

    const updated = normaliseEntry(updater(file.entries[index]));
    const entries = [...file.entries];
    entries[index] = updated;
    await this.write({
      schemaVersion: 1,
      entries,
    });
    return updated;
  }

  private async write(file: ConversationReplyDeliveryFile): Promise<void> {
    await this.writer.write(this.resolveFilePath(), normaliseFile(file));
  }
}

function normaliseFile(file: ConversationReplyDeliveryFile): ConversationReplyDeliveryFile {
  return {
    schemaVersion: 1,
    entries: file.entries.map(normaliseEntry),
  };
}

function normaliseEntry(entry: ConversationReplyDeliveryRecord): ConversationReplyDeliveryRecord {
  return {
    ...entry,
    replyId: entry.replyId.trim(),
    sourceMessageId: entry.sourceMessageId.trim(),
    sourceChatJid: entry.sourceChatJid.trim(),
    sourceChatType: entry.sourceChatType,
    sourceGroupJid: entry.sourceGroupJid?.trim() || null,
    sourcePersonId: entry.sourcePersonId?.trim() || null,
    targetChatJid: entry.targetChatJid.trim(),
    targetChatType: entry.targetChatType,
    replyText: entry.replyText.trim(),
    state: entry.state,
    reason: entry.reason?.trim() || null,
    outboundMessageId: entry.outboundMessageId?.trim() || null,
    armedAt: entry.armedAt,
    acceptedAt: entry.acceptedAt,
    observedAt: entry.observedAt,
    confirmedAt: entry.confirmedAt,
    failedAt: entry.failedAt,
    ack: Number.isInteger(entry.ack) ? entry.ack : null,
    lastError: entry.lastError?.trim() || null,
    updatedAt: entry.updatedAt,
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
