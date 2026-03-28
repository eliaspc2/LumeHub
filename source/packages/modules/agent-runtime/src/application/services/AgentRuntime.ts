import { randomUUID } from 'node:crypto';

import type { AssistantContextModuleContract } from '@lume-hub/assistant-context';
import type { AudienceRoutingModuleContract, DistributionPlan } from '@lume-hub/audience-routing';
import type { CommandPolicyModuleContract, PolicyActorContext } from '@lume-hub/command-policy';
import type { InstructionQueueModuleContract } from '@lume-hub/instruction-queue';
import type { IntentClassifierModuleContract } from '@lume-hub/intent-classifier';
import type { LlmOrchestratorModuleContract } from '@lume-hub/llm-orchestrator';
import type { OwnerControlModuleContract } from '@lume-hub/owner-control';

import type {
  AgentAssistantTurnInput,
  AgentMemoryUsage,
  AgentExecutionPlan,
  AgentSchedulingInsight,
  AgentToolResult,
  AgentTurnResult,
} from '../../domain/entities/AgentRuntime.js';
import { AgentDecisionService } from '../../domain/services/AgentDecisionService.js';
import { ToolCallPolicy } from '../../domain/services/ToolCallPolicy.js';
import { ToolRegistry } from '../../domain/services/ToolRegistry.js';

export class AgentRuntime {
  constructor(
    private readonly assistantContext: Pick<
      AssistantContextModuleContract,
      'buildChatContext' | 'buildSchedulingContext'
    >,
    private readonly audienceRouting: Pick<AudienceRoutingModuleContract, 'previewDistributionPlan'>,
    private readonly commandPolicy: Pick<
      CommandPolicyModuleContract,
      'canManageCalendar' | 'canUseAssistant'
    >,
    private readonly instructionQueue: Pick<InstructionQueueModuleContract, 'enqueueDistributionPlan'>,
    private readonly intentClassifier: Pick<IntentClassifierModuleContract, 'classifyMessage'>,
    private readonly llmOrchestrator: Pick<
      LlmOrchestratorModuleContract,
      'chat' | 'parseSchedules'
    >,
    private readonly ownerControl: Pick<OwnerControlModuleContract, 'detectOwnerCommand' | 'executeOwnerCommand'>,
    private readonly toolRegistry = new ToolRegistry(),
    private readonly toolCallPolicy = new ToolCallPolicy(),
    private readonly decisionService = new AgentDecisionService(),
  ) {}

  listTools() {
    return this.toolRegistry.listTools();
  }

  async executeConversationTurn(input: AgentAssistantTurnInput): Promise<AgentTurnResult> {
    return this.executeAssistantTurn(input);
  }

  async executeAssistantTurn(input: AgentAssistantTurnInput): Promise<AgentTurnResult> {
    const classification = this.intentClassifier.classifyMessage({
      text: input.text,
      chatType: input.chatType,
      wasTagged: input.wasTagged,
      isReplyToBot: input.isReplyToBot,
    });
    const policyContext: PolicyActorContext = {
      personId: input.personId ?? null,
      groupJid: input.groupJid ?? null,
      chatType: input.chatType,
      chatJid: input.chatJid,
      wasTagged: input.wasTagged,
      isReplyToBot: input.isReplyToBot,
    };
    const assistantAllowed = await this.commandPolicy.canUseAssistant(policyContext);
    const chatContext = await this.assistantContext.buildChatContext(input);
    const chatMemoryUsage = buildMemoryUsage(chatContext);
    const schedulingContext =
      classification.intent === 'scheduling_request'
        ? await this.assistantContext.buildSchedulingContext({
            ...input,
            requestedAccessMode: classification.requestedAccessMode,
          })
        : null;
    const session = this.decisionService.createSession(
      classification,
      assistantAllowed,
      policyContext,
      chatContext,
      schedulingContext,
    );
    let plan = this.decisionService.buildInitialPlan(classification, assistantAllowed);
    const toolResults: AgentToolResult[] = [];
    let replyText: string | null = null;
    let distributionPlan: DistributionPlan | null = null;
    let enqueuedInstruction: AgentTurnResult['enqueuedInstruction'] = null;
    let ownerCommandResult: AgentTurnResult['ownerCommandResult'] = null;
    let scheduleParseResult: AgentTurnResult['scheduleParseResult'] = null;
    let llmChatResult: AgentTurnResult['llmChatResult'] = null;
    let schedulingInsight: AgentTurnResult['schedulingInsight'] = schedulingContext
      ? {
          requestedAccessMode: schedulingContext.requestedAccessMode,
          resolvedGroupJids: schedulingContext.resolvedGroupJids,
          memoryUsage: buildMemoryUsage(schedulingContext.chatContext),
        }
      : null;

    if (classification.intent === 'owner_command' || this.ownerControl.detectOwnerCommand(input.text)) {
      ownerCommandResult = await this.ownerControl.executeOwnerCommand({
        personId: input.personId ?? null,
        groupJid: input.groupJid ?? null,
        messageText: input.text,
      });
      replyText = ownerCommandResult.output;
      toolResults.push({
        toolName: 'owner_command',
        status: ownerCommandResult.accepted ? 'success' : 'blocked',
        summary: ownerCommandResult.reason ?? 'owner_command_executed',
        data: ownerCommandResult,
      });

      return {
        plan,
        session,
        memoryUsage: chatMemoryUsage,
        schedulingInsight,
        toolResults,
        replyText,
        distributionPlan,
        enqueuedInstruction,
        ownerCommandResult,
        scheduleParseResult,
        llmChatResult,
      };
    }

    if (!assistantAllowed) {
      return {
        plan,
        session,
        memoryUsage: chatMemoryUsage,
        schedulingInsight,
        toolResults,
        replyText,
        distributionPlan,
        enqueuedInstruction,
        ownerCommandResult,
        scheduleParseResult,
        llmChatResult,
      };
    }

    if (classification.intent === 'fanout_request') {
      distributionPlan = await this.audienceRouting.previewDistributionPlan(input.messageId, {
        personId: input.personId ?? undefined,
        identifiers: input.identifiers,
        messageText: input.text,
      });
      toolResults.push({
        toolName: 'fanout_preview',
        status: distributionPlan.targetCount > 0 ? 'success' : 'blocked',
        summary:
          distributionPlan.targetCount > 0
            ? `fanout_preview:${distributionPlan.targetCount}`
            : 'fanout_preview:no_targets',
        data: distributionPlan,
      });

      if (this.toolCallPolicy.canExecuteFanOut(input, distributionPlan)) {
        enqueuedInstruction = await this.instructionQueue.enqueueDistributionPlan({
          plan: distributionPlan,
          content: {
            kind: 'text',
            messageText: input.text,
          },
          mode: 'confirmed',
        });
        toolResults.push({
          toolName: 'fanout_execute',
          status: 'success',
          summary: `fanout_enqueued:${enqueuedInstruction.instructionId}`,
          data: enqueuedInstruction,
        });
        plan = this.decisionService.withAdditionalTool(plan, 'fanout_execute');
      }

      llmChatResult = await this.llmOrchestrator.chat({
        text: input.text,
        intent: classification.intent,
        contextSummary: summariseContext(chatContext, chatMemoryUsage),
        domainFacts: buildFanoutFacts(distributionPlan, enqueuedInstruction),
        memoryScope: toLlmMemoryScope(chatMemoryUsage),
      });
      replyText = llmChatResult.text;
    } else if (classification.intent === 'scheduling_request') {
      const targetGroupJid = schedulingContext?.resolvedGroupJids[0] ?? input.groupJid ?? null;
      const requestedAccessMode = classification.requestedAccessMode ?? 'read';
      const schedulingMemoryUsage = schedulingContext
        ? buildMemoryUsage(schedulingContext.chatContext, targetGroupJid)
        : buildMemoryUsage(chatContext, targetGroupJid);
      schedulingInsight = {
        requestedAccessMode,
        resolvedGroupJids: schedulingContext?.resolvedGroupJids ?? [],
        memoryUsage: schedulingMemoryUsage,
      };
      const hasAccess =
        targetGroupJid === null
          ? requestedAccessMode === 'read'
          : await this.commandPolicy.canManageCalendar(targetGroupJid, input.personId ?? null, requestedAccessMode);

      if (!hasAccess) {
        plan = this.decisionService.withAdditionalNote(plan, 'schedule_acl_blocked');
        replyText = `Nao posso tratar alteracoes de calendario aqui porque o acesso exigido e '${requestedAccessMode}' e a ACL desse grupo nao permite.`;
        toolResults.push({
          toolName: 'schedule_parse',
          status: 'blocked',
          summary: `schedule_acl_blocked:${requestedAccessMode}`,
        });
      } else {
        scheduleParseResult = await this.llmOrchestrator.parseSchedules({
          text: input.text,
          contextSummary: summariseContext(chatContext, schedulingMemoryUsage),
          domainFacts: buildSchedulingFacts(schedulingContext?.chatContext ?? chatContext, schedulingMemoryUsage, targetGroupJid),
          memoryScope: toLlmMemoryScope(schedulingMemoryUsage),
        });
        toolResults.push({
          toolName: 'schedule_parse',
          status: 'success',
          summary: `schedule_candidates:${scheduleParseResult.candidates.length}`,
          data: scheduleParseResult,
        });
        llmChatResult = await this.llmOrchestrator.chat({
          text: input.text,
          intent: classification.intent,
          contextSummary: summariseContext(chatContext, schedulingMemoryUsage),
          domainFacts: [
            ...buildSchedulingFacts(schedulingContext?.chatContext ?? chatContext, schedulingMemoryUsage, targetGroupJid),
            `schedule_candidates=${scheduleParseResult.candidates.length}`,
            ...scheduleParseResult.candidates.map(
              (candidate) =>
                `candidato:${candidate.title}:${candidate.dateHint ?? 'sem_data'}:${candidate.timeHint ?? 'sem_hora'}`,
            ),
          ],
          memoryScope: toLlmMemoryScope(schedulingMemoryUsage),
        });
        replyText = llmChatResult.text;
      }
    } else {
      llmChatResult = await this.llmOrchestrator.chat({
        text: input.text,
        intent: classification.intent,
        contextSummary: summariseContext(chatContext, chatMemoryUsage),
        domainFacts: buildGeneralFacts(chatContext, chatMemoryUsage),
        memoryScope: toLlmMemoryScope(chatMemoryUsage),
      });
      replyText = llmChatResult.text;
      toolResults.push({
        toolName: 'chat_reply',
        status: 'success',
        summary: 'chat_reply_generated',
      });
    }

    return {
      plan,
      session,
      memoryUsage: chatMemoryUsage,
      schedulingInsight,
      toolResults,
      replyText,
      distributionPlan,
      enqueuedInstruction,
      ownerCommandResult,
      scheduleParseResult,
      llmChatResult,
    };
  }
}

function summariseContext(
  chatContext: AgentTurnResult['session']['chatContext'],
  memoryUsage: AgentMemoryUsage,
): readonly string[] {
  return [
    chatContext.group ? `grupo=${chatContext.group.preferredSubject}` : null,
    chatContext.activeReference ? `referente=${chatContext.activeReference.label}` : null,
    memoryUsage.scope === 'group'
      ? `memoria=${memoryUsage.groupLabel ?? memoryUsage.groupJid ?? 'grupo'}:${memoryUsage.instructionsSource ?? 'sem_fonte'}:${memoryUsage.knowledgeSnippetCount}_snippets`
      : null,
    ...chatContext.relevantMessages.slice(-3).map((message) => `${message.role}:${message.text}`),
  ].filter((value): value is string => Boolean(value));
}

function buildFanoutFacts(distributionPlan: DistributionPlan, enqueuedInstruction: AgentTurnResult['enqueuedInstruction']): readonly string[] {
  const facts = [
    ...distributionPlan.targets.map((target) => `target=${target.preferredSubject}`),
    `fanout_targets=${distributionPlan.targetCount}`,
    `fanout_requires_confirmation=${distributionPlan.requiresConfirmation}`,
  ];

  if (enqueuedInstruction) {
    facts.unshift(`fanout_enqueued=${enqueuedInstruction.instructionId}`);
  }

  return facts;
}

function buildGeneralFacts(
  chatContext: AgentTurnResult['session']['chatContext'],
  memoryUsage: AgentMemoryUsage,
): readonly string[] {
  return [
    chatContext.activeReference ? `referente_ativo=${chatContext.activeReference.label}` : null,
    chatContext.group ? `grupo_atual=${chatContext.group.preferredSubject}` : null,
    chatContext.personNotes[0] ? `nota=${chatContext.personNotes[0].text}` : null,
    ...buildMemoryFacts(memoryUsage),
  ].filter((value): value is string => Boolean(value));
}

function buildSchedulingFacts(
  chatContext: AgentTurnResult['session']['chatContext'],
  memoryUsage: AgentMemoryUsage,
  targetGroupJid: string | null,
): readonly string[] {
  return [
    targetGroupJid ? `grupo_resolvido=${targetGroupJid}` : 'grupo_resolvido=indefinido',
    chatContext.activeReference ? `referente_ativo=${chatContext.activeReference.label}` : null,
    ...buildMemoryFacts(memoryUsage),
  ].filter((value): value is string => Boolean(value));
}

function buildMemoryFacts(memoryUsage: AgentMemoryUsage): readonly string[] {
  if (memoryUsage.scope !== 'group') {
    return [];
  }

  return [
    `memoria_grupo=${memoryUsage.groupLabel ?? memoryUsage.groupJid ?? 'grupo'}`,
    `instructions_source=${memoryUsage.instructionsSource ?? 'missing'}`,
    `instructions_applied=${memoryUsage.instructionsApplied}`,
    `knowledge_snippets=${memoryUsage.knowledgeSnippetCount}`,
    ...memoryUsage.knowledgeDocuments.slice(0, 3).map(
      (document) => `knowledge_doc=${document.documentId}:${document.title}:${document.filePath}`,
    ),
  ];
}

function buildMemoryUsage(
  chatContext: AgentTurnResult['session']['chatContext'],
  forcedGroupJid?: string | null,
): AgentMemoryUsage {
  const resolvedGroupJid = forcedGroupJid ?? chatContext.groupJid ?? null;
  const resolvedGroupLabel =
    resolvedGroupJid !== null && chatContext.group?.groupJid === resolvedGroupJid
      ? chatContext.group.preferredSubject
      : chatContext.group?.preferredSubject ?? null;
  const filteredSnippets =
    resolvedGroupJid === null
      ? []
      : chatContext.groupKnowledgeSnippets.filter((snippet) => snippet.groupJid === resolvedGroupJid);

  if (!resolvedGroupJid) {
    return {
      scope: 'none',
      groupJid: null,
      groupLabel: null,
      instructionsSource: null,
      instructionsApplied: false,
      knowledgeSnippetCount: 0,
      knowledgeDocuments: [],
    };
  }

  return {
    scope: 'group',
    groupJid: resolvedGroupJid,
    groupLabel: resolvedGroupLabel,
    instructionsSource: chatContext.groupInstructionsSource,
    instructionsApplied: chatContext.groupInstructionsSource !== 'missing' && Boolean(chatContext.groupInstructions?.trim()),
    knowledgeSnippetCount: filteredSnippets.length,
    knowledgeDocuments: filteredSnippets.slice(0, 4).map((snippet) => ({
      documentId: snippet.documentId,
      title: snippet.title,
      filePath: snippet.filePath,
      score: snippet.score,
      matchedTerms: snippet.matchedTerms,
    })),
  };
}

function toLlmMemoryScope(memoryUsage: AgentMemoryUsage): {
  readonly scope: 'none' | 'group';
  readonly groupJid: string | null;
  readonly groupLabel: string | null;
  readonly instructionsSource: 'llm_instructions' | 'missing' | null;
  readonly instructionsApplied: boolean;
  readonly knowledgeSnippetCount: number;
  readonly knowledgeDocuments: readonly {
    readonly documentId: string;
    readonly title: string;
    readonly filePath: string;
    readonly score?: number;
    readonly matchedTerms?: readonly string[];
  }[];
} {
  return {
    scope: memoryUsage.scope,
    groupJid: memoryUsage.groupJid,
    groupLabel: memoryUsage.groupLabel,
    instructionsSource: memoryUsage.instructionsSource,
    instructionsApplied: memoryUsage.instructionsApplied,
    knowledgeSnippetCount: memoryUsage.knowledgeSnippetCount,
    knowledgeDocuments: memoryUsage.knowledgeDocuments.map((document) => ({
      documentId: document.documentId,
      title: document.title,
      filePath: document.filePath,
      score: document.score,
      matchedTerms: document.matchedTerms,
    })),
  };
}
