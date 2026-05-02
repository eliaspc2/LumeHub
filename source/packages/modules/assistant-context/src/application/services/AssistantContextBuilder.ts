import { randomUUID } from 'node:crypto';

import type { GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type { GroupKnowledgeModuleContract } from '@lume-hub/group-knowledge';
import type { PeopleMemoryModuleContract } from '@lume-hub/people-memory';

import type {
  AssistantChatContext,
  BuildChatContextInput,
  BuildSchedulingContextInput,
  RecordConversationMessageInput,
} from '../../domain/entities/AssistantContext.js';
import { ConversationHistoryReader } from './ConversationHistoryReader.js';
import { ScheduleContextProvider } from './ScheduleContextProvider.js';
import { ActiveReferenceResolver } from '../../domain/services/ActiveReferenceResolver.js';
import { ConversationRelevanceRanker } from '../../domain/services/ConversationRelevanceRanker.js';
import { ConversationHistoryRepository } from '../../infrastructure/persistence/ConversationHistoryRepository.js';

const DEFAULT_RECENT_HISTORY_LIMIT = 60;
const DEFAULT_RELEVANT_HISTORY_LIMIT = 8;

export class AssistantContextBuilder {
  constructor(
    private readonly repository: ConversationHistoryRepository,
    private readonly historyReader: ConversationHistoryReader,
    private readonly ranker: ConversationRelevanceRanker,
    private readonly activeReferenceResolver: ActiveReferenceResolver,
    private readonly peopleMemory: Pick<PeopleMemoryModuleContract, 'findPersonById' | 'listImportantNotes' | 'listPeople'>,
    private readonly groupDirectory: Pick<
      GroupDirectoryModuleContract,
      'findByJid' | 'getGroupLlmInstructions' | 'getGroupPolicy'
    >,
    private readonly groupKnowledge: Pick<GroupKnowledgeModuleContract, 'retrieveRelevantSnippets'>,
    private readonly scheduleContextProvider: ScheduleContextProvider,
  ) {}

  async recordMessage(input: RecordConversationMessageInput, now = new Date()) {
    return this.repository.appendMessage({
      messageId: input.messageId.trim() || `conversation-message-${randomUUID()}`,
      chatJid: input.chatJid.trim(),
      chatType: input.chatType,
      groupJid: input.groupJid?.trim() || null,
      personId: input.personId?.trim() || null,
      senderDisplayName: input.senderDisplayName?.trim() || null,
      role: input.role,
      text: input.text.trim(),
      createdAt: now.toISOString(),
    });
  }

  async listChatHistory(chatJid: string, limit = DEFAULT_RECENT_HISTORY_LIMIT) {
    return this.historyReader.listRecentMessages(chatJid, limit);
  }

  async buildChatContext(input: BuildChatContextInput, now = new Date()): Promise<AssistantChatContext> {
    const recentMessages = await this.historyReader.listRecentMessages(
      input.chatJid,
      input.recentHistoryLimit ?? DEFAULT_RECENT_HISTORY_LIMIT,
    );
    const relevantMessages = this.ranker.rank(
      input.text,
      recentMessages,
      input.relevantHistoryLimit ?? DEFAULT_RELEVANT_HISTORY_LIMIT,
    );
    const activeReference = await this.activeReferenceResolver.resolve({
      currentText: input.text,
      recentMessages,
    });
    const resolvedGroupJid = input.groupJid ?? activeReference?.groupJid ?? null;
    const group = resolvedGroupJid ? await this.groupDirectory.findByJid(resolvedGroupJid) : undefined;
    const personNotes = input.personId ? await this.peopleMemory.listImportantNotes(input.personId) : [];
    const groupInstructions = group ? await this.groupDirectory.getGroupLlmInstructions(group.groupJid) : null;
    const groupKnowledgeSnippets = group
      ? await this.groupKnowledge.retrieveRelevantSnippets({
          groupJid: group.groupJid,
          query: input.text,
        })
      : [];
    const groupPolicy = group ? await this.groupDirectory.getGroupPolicy(group.groupJid) : null;
    const appOwners = (await this.peopleMemory.listPeople())
      .filter((person) => person.globalRoles.includes('app_owner'))
      .map((person) => ({
        personId: person.personId,
        displayName: person.displayName,
        identifiers: person.identifiers,
      }));

    return {
      chatJid: input.chatJid,
      chatType: input.chatType,
      currentText: input.text.trim(),
      personId: input.personId?.trim() || null,
      senderDisplayName: input.senderDisplayName?.trim() || (input.personId ? (await this.peopleMemory.findPersonById(input.personId))?.displayName ?? null : null),
      groupJid: group?.groupJid ?? null,
      group: group
        ? {
            groupJid: group.groupJid,
            preferredSubject: group.preferredSubject,
            aliases: group.aliases,
            courseId: group.courseId,
          }
        : null,
      recentMessages,
      relevantMessages,
      activeReference,
      personNotes,
      appOwners,
      groupInstructions: groupInstructions?.content ?? null,
      groupInstructionsSource: groupInstructions?.source ?? 'missing',
      groupKnowledgeSnippets,
      groupPolicy: groupPolicy?.value ?? null,
      generatedAt: now.toISOString(),
    };
  }

  async buildSchedulingContext(input: BuildSchedulingContextInput, now = new Date()) {
    const chatContext = await this.buildChatContext(input, now);
    return this.scheduleContextProvider.build(input, chatContext);
  }
}
