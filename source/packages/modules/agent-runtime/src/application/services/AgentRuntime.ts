import { createHash, randomUUID } from 'node:crypto';

import type { AssistantContextModuleContract, AssistantChatContext, SchedulingContext } from '@lume-hub/assistant-context';
import type { AudienceRoutingModuleContract, DistributionPlan } from '@lume-hub/audience-routing';
import type { CommandPolicyModuleContract, PolicyActorContext } from '@lume-hub/command-policy';
import type { CalendarAccessMode, Group, GroupDirectoryModuleContract } from '@lume-hub/group-directory';
import type {
  Instruction,
  InstructionQueueModuleContract,
  ScheduleApplyActionPayload,
  ScheduleApplyOperation,
} from '@lume-hub/instruction-queue';
import type { IntentClassifierModuleContract } from '@lume-hub/intent-classifier';
import type {
  LlmOrchestratorModuleContract,
  LlmScheduleCandidate,
  LlmScheduleParseResult,
} from '@lume-hub/llm-orchestrator';
import type { NotificationRuleDefinitionInput } from '@lume-hub/notification-rules';
import type { OwnerControlModuleContract } from '@lume-hub/owner-control';
import type { WeeklyPlannerEventSummary, WeeklyPlannerModuleContract, WeeklyPlannerSnapshot } from '@lume-hub/weekly-planner';

import type {
  AgentAssistantTurnInput,
  AgentExecutionPlan,
  AgentMemoryUsage,
  AgentScheduleActionInput,
  AgentScheduleApplyInput,
  AgentScheduleApplyPreview,
  AgentScheduleApplyResult,
  AgentScheduleDiffEntry,
  AgentSchedulingInsight,
  AgentToolResult,
  AgentTurnResult,
} from '../../domain/entities/AgentRuntime.js';
import { AgentDecisionService } from '../../domain/services/AgentDecisionService.js';
import { ToolCallPolicy } from '../../domain/services/ToolCallPolicy.js';
import { ToolRegistry } from '../../domain/services/ToolRegistry.js';

const DEFAULT_SCHEDULE_DURATION_MINUTES = 60;
const LLM_CONTEXT_MIN_MESSAGE_LIMIT = 30;
const LLM_CONTEXT_MAX_MESSAGE_LIMIT = 50;
const LLM_CONTEXT_TIMELINE_MARGIN_MESSAGES = 2;
const LLM_CONTEXT_CONTIGUOUS_GAP_MS = 15 * 60 * 1000;
const LLM_CONTEXT_MESSAGE_MAX_LENGTH = 800;
const GENERIC_CANDIDATE_TITLES = new Set(['evento sem titulo explicito', 'evento sem título explicito']);
const DAY_LABEL_TO_INDEX = new Map<string, number>([
  ['segunda', 1],
  ['segunda-feira', 1],
  ['terca', 2],
  ['terça', 2],
  ['terca-feira', 2],
  ['terça-feira', 2],
  ['quarta', 3],
  ['quarta-feira', 3],
  ['quinta', 4],
  ['quinta-feira', 4],
  ['sexta', 5],
  ['sexta-feira', 5],
  ['sabado', 6],
  ['sábado', 6],
  ['sabado-feira', 6],
  ['sábado-feira', 6],
  ['domingo', 7],
]);

interface SchedulingEvaluation {
  readonly classification: ReturnType<IntentClassifierModuleContract['classifyMessage']>;
  readonly chatContext: AssistantChatContext;
  readonly schedulingContext: SchedulingContext;
  readonly schedulingMemoryUsage: AgentMemoryUsage;
  readonly targetGroupJid: string | null;
  readonly targetGroupLabel: string | null;
  readonly targetGroup: Group | null;
  readonly requestedAccessMode: CalendarAccessMode | null;
  readonly hasAccess: boolean;
  readonly weekSnapshot: WeeklyPlannerSnapshot | null;
  readonly parseResult: LlmScheduleParseResult | null;
  readonly routingDecision: SchedulingRoutingDecision | null;
}

interface SchedulingRoutingDecision {
  readonly route: 'schedule' | 'manual_only' | 'distribution_only';
  readonly blockingReason: string | null;
}

type AgentContextMessage = AgentTurnResult['session']['chatContext']['recentMessages'][number];

export class AgentRuntime {
  constructor(
    private readonly assistantContext: Pick<
      AssistantContextModuleContract,
      'buildChatContext' | 'buildSchedulingContext'
    >,
    private readonly audienceRouting: Pick<AudienceRoutingModuleContract, 'previewDistributionPlan'>,
    private readonly commandPolicy: Pick<
      CommandPolicyModuleContract,
      'canManageCalendar' | 'explainAssistantAccess'
    >,
    private readonly groupDirectory: Pick<GroupDirectoryModuleContract, 'findByJid'>,
    private readonly instructionQueue: Pick<
      InstructionQueueModuleContract,
      'enqueueDistributionPlan' | 'enqueueScheduleApply' | 'listInstructions' | 'tickWorker'
    >,
    private readonly intentClassifier: Pick<IntentClassifierModuleContract, 'classifyMessage'>,
    private readonly llmOrchestrator: Pick<
      LlmOrchestratorModuleContract,
      'chat' | 'parseSchedules'
    >,
    private readonly ownerControl: Pick<OwnerControlModuleContract, 'detectOwnerCommand' | 'executeOwnerCommand'>,
    private readonly weeklyPlanner: Pick<WeeklyPlannerModuleContract, 'getWeekSnapshot'>,
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

  async previewScheduleApply(input: AgentScheduleActionInput): Promise<AgentScheduleApplyPreview> {
    const evaluation = await this.evaluateSchedulingRequest(input, input.requestedAccessMode ?? 'read_write');
    return this.buildScheduleApplyPreview(evaluation, input);
  }

  async applyScheduleAction(input: AgentScheduleApplyInput): Promise<AgentScheduleApplyResult> {
    const preview = await this.previewScheduleApply(input);
    return this.applySchedulePreview(preview, input);
  }

  private async applySchedulePreview(
    preview: AgentScheduleApplyPreview,
    input: AgentScheduleApplyInput,
  ): Promise<AgentScheduleApplyResult> {
    if (!preview.canApply || !preview.previewFingerprint || !preview.operation || !preview.groupJid || !preview.weekId) {
      throw new Error(preview.blockingReason ?? 'Scheduling preview is not ready to apply.');
    }

    if (input.previewFingerprint?.trim() && input.previewFingerprint.trim() !== preview.previewFingerprint) {
      throw new Error('O preview mudou desde a ultima leitura. Atualiza o preview antes de aplicar.');
    }

    const payload = this.buildScheduleApplyPayload(preview, input);
    const instruction = await this.instructionQueue.enqueueScheduleApply({
      payload,
      mode: 'confirmed',
      dedupeKey: buildScheduleApplyDedupeKey(payload),
    });

    await this.instructionQueue.tickWorker(new Date());
    const appliedInstruction =
      (await this.instructionQueue.listInstructions()).find((candidate) => candidate.instructionId === instruction.instructionId) ??
      instruction;
    const appliedEvent = readAppliedEventFromInstruction(appliedInstruction);

    return {
      preview,
      instruction,
      appliedInstruction,
      appliedEvent,
    };
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
    const assistantAccess = await this.commandPolicy.explainAssistantAccess(policyContext);
    const assistantAllowed = assistantAccess.allowed;
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
      assistantAccess,
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
    let scheduleApplyPreview: AgentTurnResult['scheduleApplyPreview'] = null;
    let scheduleApplyResult: AgentTurnResult['scheduleApplyResult'] = null;
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
        scheduleApplyPreview,
        scheduleApplyResult,
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
      plan = this.decisionService.withAdditionalNote(plan, assistantAccess.reasonCode);
      toolResults.push({
        toolName: 'chat_reply',
        status: 'blocked',
        summary: `assistant_blocked:${assistantAccess.reasonCode}`,
        data: assistantAccess,
      });

      return {
        plan,
        session,
        memoryUsage: chatMemoryUsage,
        schedulingInsight,
        scheduleApplyPreview,
        scheduleApplyResult,
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
      const targetGroup = targetGroupJid ? (await this.groupDirectory.findByJid(targetGroupJid)) ?? null : null;
      const routingDecision = resolveSchedulingRoutingDecision(targetGroup);
      const requestedAccessMode = classification.requestedAccessMode ?? 'read';
      const schedulingMemoryUsage = schedulingContext
        ? buildMemoryUsage(schedulingContext.chatContext, targetGroupJid)
        : buildMemoryUsage(chatContext, targetGroupJid);
      const weekSnapshot = targetGroupJid
        ? await this.weeklyPlanner.getWeekSnapshot({
            groupJid: targetGroupJid,
          })
        : null;
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
      } else if (routingDecision?.blockingReason) {
        plan = this.decisionService.withAdditionalNote(plan, 'schedule_mode_blocked');
        replyText = routingDecision.blockingReason;
        toolResults.push({
          toolName: 'schedule_parse',
          status: 'blocked',
          summary: `schedule_mode_blocked:${routingDecision.route}`,
          data: {
            groupJid: targetGroupJid,
            groupLabel: targetGroup?.preferredSubject ?? null,
            route: routingDecision.route,
            blockingReason: routingDecision.blockingReason,
          },
        });
      } else {
        scheduleParseResult = await this.llmOrchestrator.parseSchedules({
          text: input.text,
          contextSummary: summariseContext(chatContext, schedulingMemoryUsage),
          domainFacts: buildSchedulingFacts(
            schedulingContext?.chatContext ?? chatContext,
            schedulingMemoryUsage,
            targetGroupJid,
            weekSnapshot,
          ),
          memoryScope: toLlmMemoryScope(schedulingMemoryUsage),
        });
        toolResults.push({
          toolName: 'schedule_parse',
          status: 'success',
          summary: `schedule_candidates:${scheduleParseResult.candidates.length}`,
          data: scheduleParseResult,
        });

        if (requestedAccessMode === 'read_write' && input.allowActions) {
          const scheduleEvaluation = {
            classification,
            chatContext,
            schedulingContext: schedulingContext ?? {
              chatContext,
              requestedAccessMode,
              resolvedGroupJids: targetGroupJid ? [targetGroupJid] : [],
            },
            schedulingMemoryUsage,
            targetGroupJid,
            targetGroupLabel: weekSnapshot?.groups.find((group) => group.groupJid === targetGroupJid)?.preferredSubject
              ?? targetGroup?.preferredSubject
              ?? schedulingContext?.chatContext.group?.preferredSubject
              ?? null,
            targetGroup,
            requestedAccessMode,
            hasAccess,
            weekSnapshot,
            parseResult: scheduleParseResult,
            routingDecision,
          } satisfies SchedulingEvaluation;
          const directExecution = looksLikeDirectScheduleExecutionRequest(input.text);
          const candidateIndexes =
            directExecution && scheduleParseResult.candidates.length > 1
              ? scheduleParseResult.candidates.map((_candidate, index) => index)
              : [0];
          const appliedScheduleResults: AgentScheduleApplyResult[] = [];
          const blockedSchedulePreviews: AgentScheduleApplyPreview[] = [];

          for (const candidateIndex of candidateIndexes) {
            const currentPreview = this.buildScheduleApplyPreview(scheduleEvaluation, input, candidateIndex);

            if (candidateIndex === 0) {
              scheduleApplyPreview = currentPreview;
            }

            toolResults.push({
              toolName: 'schedule_apply',
              status: currentPreview.canApply ? 'success' : 'blocked',
              summary: currentPreview.canApply
                ? `schedule_apply_preview:${candidateIndex + 1}:${currentPreview.operation ?? 'unknown'}`
                : `schedule_apply_blocked:${candidateIndex + 1}:${currentPreview.blockingReason ?? 'indefinido'}`,
              data: currentPreview,
            });

            if (!directExecution) {
              continue;
            }

            if (currentPreview.canApply) {
              const currentResult = await this.applySchedulePreview(currentPreview, {
                ...input,
                requestedAccessMode,
              });
              appliedScheduleResults.push(currentResult);
              toolResults.push({
                toolName: 'schedule_apply',
                status: 'success',
                summary: `schedule_apply_executed:${currentResult.appliedEvent?.eventId ?? currentResult.instruction.instructionId}`,
                data: currentResult,
              });
            } else {
              blockedSchedulePreviews.push(currentPreview);
            }
          }

          if (directExecution) {
            scheduleApplyResult = appliedScheduleResults[0] ?? null;
            replyText = buildScheduleBatchReply(appliedScheduleResults, blockedSchedulePreviews);
          }
        }

        if (!replyText) {
          llmChatResult = await this.llmOrchestrator.chat({
            text: input.text,
            intent: classification.intent,
            contextSummary: summariseContext(chatContext, schedulingMemoryUsage),
            domainFacts: [
              ...buildSchedulingFacts(schedulingContext?.chatContext ?? chatContext, schedulingMemoryUsage, targetGroupJid, weekSnapshot),
              `schedule_candidates=${scheduleParseResult.candidates.length}`,
              ...scheduleParseResult.candidates.map(
                (candidate) =>
                  `candidato:${candidate.title}:${candidate.dateHint ?? 'sem_data'}:${candidate.timeHint ?? 'sem_hora'}`,
              ),
              ...(scheduleApplyPreview
                ? [
                    `schedule_preview_operation=${scheduleApplyPreview.operation ?? 'indefinida'}`,
                    `schedule_preview_can_apply=${scheduleApplyPreview.canApply}`,
                    `schedule_preview_summary=${scheduleApplyPreview.summary}`,
                  ]
                : []),
            ],
            memoryScope: toLlmMemoryScope(schedulingMemoryUsage),
          });
          replyText = llmChatResult.text;
        }
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
      scheduleApplyPreview,
      scheduleApplyResult,
      toolResults,
      replyText,
      distributionPlan,
      enqueuedInstruction,
      ownerCommandResult,
      scheduleParseResult,
      llmChatResult,
    };
  }

  private async evaluateSchedulingRequest(
    input: AgentScheduleActionInput,
    defaultRequestedAccessMode: CalendarAccessMode,
  ): Promise<SchedulingEvaluation> {
    const classification = this.intentClassifier.classifyMessage({
      text: input.text,
      chatType: input.chatType,
      wasTagged: input.wasTagged,
      isReplyToBot: input.isReplyToBot,
    });
    const requestedAccessMode = input.requestedAccessMode ?? classification.requestedAccessMode ?? defaultRequestedAccessMode;
    const chatContext = await this.assistantContext.buildChatContext(input);
    const schedulingContext = await this.assistantContext.buildSchedulingContext({
      ...input,
      requestedAccessMode,
    });
    const targetGroupJid = schedulingContext.resolvedGroupJids[0] ?? input.groupJid ?? null;
    const targetGroup = targetGroupJid ? (await this.groupDirectory.findByJid(targetGroupJid)) ?? null : null;
    const routingDecision = resolveSchedulingRoutingDecision(targetGroup);
    const schedulingMemoryUsage = buildMemoryUsage(schedulingContext.chatContext, targetGroupJid);
    const hasAccess =
      targetGroupJid === null
        ? requestedAccessMode === 'read'
        : await this.commandPolicy.canManageCalendar(targetGroupJid, input.personId ?? null, requestedAccessMode);
    const weekSnapshot = targetGroupJid
      ? await this.weeklyPlanner.getWeekSnapshot({
          groupJid: targetGroupJid,
          weekId: input.weekId ?? undefined,
        })
      : null;
    const parseResult =
      classification.intent === 'scheduling_request' && hasAccess && targetGroupJid && !routingDecision?.blockingReason
        ? await this.llmOrchestrator.parseSchedules({
            text: input.text,
            contextSummary: summariseContext(chatContext, schedulingMemoryUsage),
            domainFacts: buildSchedulingFacts(schedulingContext.chatContext, schedulingMemoryUsage, targetGroupJid, weekSnapshot),
            memoryScope: toLlmMemoryScope(schedulingMemoryUsage),
          })
        : null;

    return {
      classification,
      chatContext,
      schedulingContext,
      schedulingMemoryUsage,
      targetGroupJid,
      targetGroup,
      targetGroupLabel: weekSnapshot?.groups.find((group) => group.groupJid === targetGroupJid)?.preferredSubject
        ?? targetGroup?.preferredSubject
        ?? schedulingContext.chatContext.group?.preferredSubject
        ?? null,
      requestedAccessMode,
      hasAccess,
      weekSnapshot,
      parseResult,
      routingDecision,
    };
  }

  private buildScheduleApplyPreview(
    evaluation: SchedulingEvaluation,
    input: AgentScheduleActionInput,
    candidateIndex = 0,
  ): AgentScheduleApplyPreview {
    if (evaluation.classification.intent !== 'scheduling_request') {
      return createBlockedSchedulePreview({
        requestText: input.text,
        requestedAccessMode: evaluation.requestedAccessMode,
        groupJid: evaluation.targetGroupJid,
        groupLabel: evaluation.targetGroupLabel,
        weekId: evaluation.weekSnapshot?.focusWeekLabel ?? null,
        blockingReason: 'Este texto nao parece um pedido de agendamento ou alteracao de calendario.',
      });
    }

    if (!evaluation.targetGroupJid || !evaluation.weekSnapshot) {
      return createBlockedSchedulePreview({
        requestText: input.text,
        requestedAccessMode: evaluation.requestedAccessMode,
        groupJid: null,
        groupLabel: null,
        weekId: null,
        blockingReason: 'Nao foi possivel resolver o grupo certo para aplicar este pedido de calendario.',
      });
    }

    if (!evaluation.hasAccess) {
      return createBlockedSchedulePreview({
        requestText: input.text,
        requestedAccessMode: evaluation.requestedAccessMode,
        groupJid: evaluation.targetGroupJid,
        groupLabel: evaluation.targetGroupLabel,
        weekId: evaluation.weekSnapshot.focusWeekLabel,
        blockingReason: `A ACL deste grupo nao permite acesso '${evaluation.requestedAccessMode ?? 'read'}' para esta alteracao.`,
      });
    }

    if (evaluation.routingDecision?.blockingReason) {
      return createBlockedSchedulePreview({
        requestText: input.text,
        requestedAccessMode: evaluation.requestedAccessMode,
        groupJid: evaluation.targetGroupJid,
        groupLabel: evaluation.targetGroupLabel,
        weekId: evaluation.weekSnapshot?.focusWeekLabel ?? null,
        blockingReason: evaluation.routingDecision.blockingReason,
      });
    }

    if (!evaluation.parseResult || evaluation.parseResult.candidates.length === 0) {
      return createBlockedSchedulePreview({
        requestText: input.text,
        requestedAccessMode: evaluation.requestedAccessMode,
        groupJid: evaluation.targetGroupJid,
        groupLabel: evaluation.targetGroupLabel,
        weekId: evaluation.weekSnapshot.focusWeekLabel,
        blockingReason: 'A LLM nao conseguiu extrair dados suficientes para montar um agendamento aplicavel.',
      });
    }

    const candidate = evaluation.parseResult.candidates[candidateIndex];

    if (!candidate) {
      return createBlockedSchedulePreview({
        requestText: input.text,
        requestedAccessMode: evaluation.requestedAccessMode,
        groupJid: evaluation.targetGroupJid,
        groupLabel: evaluation.targetGroupLabel,
        weekId: evaluation.weekSnapshot.focusWeekLabel,
        blockingReason: 'A LLM nao devolveu esse candidato de agendamento.',
      });
    }
    const targetEvent = resolveScheduleTargetEvent(input.text, candidate, evaluation.weekSnapshot.events);
    const operation = resolveScheduleOperation(input.text, targetEvent);
    const localDate = resolveLocalDateFromHint(candidate.dateHint, evaluation.weekSnapshot.focusWeekLabel);
    const startTime = normaliseTimeHint(candidate.timeHint) ?? targetEvent?.startTime ?? null;
    const dayLabel = localDate ? localDateToDayLabel(localDate) : targetEvent?.dayLabel ?? null;
    const durationMinutes = parseDurationMinutes(input.text) ?? targetEvent?.durationMinutes ?? DEFAULT_SCHEDULE_DURATION_MINUTES;
    const title = resolveCandidateTitle(candidate.title) ?? targetEvent?.title ?? null;
    const notes = extractScheduleNotes(input.text) ?? targetEvent?.notes ?? null;
    const upsert =
      operation === 'delete'
        ? null
        : ({
            eventId: operation === 'update' ? targetEvent?.eventId : undefined,
            weekId: evaluation.weekSnapshot.focusWeekLabel,
            groupJid: evaluation.targetGroupJid,
            title: title ?? '',
            localDate: localDate ?? undefined,
            startTime: startTime ?? '',
            durationMinutes,
            notes,
          } satisfies ScheduleApplyActionPayload['upsert']);
    const diff = buildScheduleDiff(operation, targetEvent, {
      title,
      localDate,
      dayLabel,
      startTime,
      durationMinutes,
      notes,
    });
    const blockingReason = resolveScheduleBlockingReason(operation, targetEvent, title, localDate, startTime, diff);
    const previewFingerprint =
      !blockingReason && operation
        ? buildScheduleApplyFingerprint({
            operation,
            groupJid: evaluation.targetGroupJid,
            weekId: evaluation.weekSnapshot.focusWeekLabel,
            targetEventId: targetEvent?.eventId ?? null,
            title,
            localDate,
            startTime,
            durationMinutes,
            notes,
            requestText: input.text,
          })
        : null;

    return {
      requestText: input.text,
      requestedAccessMode: evaluation.requestedAccessMode,
      groupJid: evaluation.targetGroupJid,
      groupLabel: evaluation.targetGroupLabel,
      weekId: evaluation.weekSnapshot.focusWeekLabel,
      previewFingerprint,
      operation,
      confidence: candidate.confidence,
      summary: buildSchedulePreviewSummary(operation, evaluation.targetGroupLabel, targetEvent, {
        title,
        localDate,
        startTime,
      }),
      canApply: !blockingReason,
      blockingReason,
      targetEvent,
      candidate: {
        title,
        localDate,
        dayLabel,
        startTime,
        durationMinutes,
        notes,
      },
      diff,
      parserNotes: [...evaluation.parseResult.notes, ...candidate.notes],
    };
  }

  private buildScheduleApplyPayload(
    preview: AgentScheduleApplyPreview,
    input: AgentScheduleApplyInput,
  ): ScheduleApplyActionPayload {
    return {
      kind: 'schedule_apply',
      operation: preview.operation ?? 'create',
      sourceMessageId: input.messageId,
      requestedText: input.text,
      requestedByPersonId: input.personId ?? null,
      requestedByDisplayName: input.senderDisplayName ?? null,
      requestedAccessMode: preview.requestedAccessMode,
      previewFingerprint: preview.previewFingerprint ?? `preview-${randomUUID()}`,
      previewSummary: preview.summary,
      groupJid: preview.groupJid ?? input.groupJid ?? '',
      groupLabel: preview.groupLabel,
      weekId: preview.weekId ?? input.weekId ?? '',
      targetEventId: preview.targetEvent?.eventId ?? null,
      targetEvent: preview.targetEvent,
      diff: preview.diff,
      upsert:
        preview.operation === 'delete' || !preview.candidate
          ? null
          : {
              eventId: preview.operation === 'update' ? preview.targetEvent?.eventId : undefined,
              weekId: preview.weekId ?? undefined,
              groupJid: preview.groupJid ?? input.groupJid ?? '',
              title: preview.candidate.title ?? '',
              localDate: preview.candidate.localDate ?? undefined,
              startTime: preview.candidate.startTime ?? '',
              durationMinutes: preview.candidate.durationMinutes ?? DEFAULT_SCHEDULE_DURATION_MINUTES,
              notes: preview.candidate.notes,
              notificationRules: extractNotificationRulesFromRequest(input.text) ?? undefined,
            },
      deleteEventId: preview.operation === 'delete' ? preview.targetEvent?.eventId ?? null : null,
    };
  }
}

function resolveSchedulingRoutingDecision(group: Group | null): SchedulingRoutingDecision | null {
  if (!group) {
    return null;
  }

  if (group.operationalSettings.mode === 'distribuicao_apenas') {
    return {
      route: 'distribution_only',
      blockingReason: `O grupo ${group.preferredSubject} esta em distribuicao apenas. Aqui nao ha scheduling local; mensagens pessoais elegiveis seguem para fan-out/distribuicao.`,
    };
  }

  if (!group.operationalSettings.schedulingEnabled) {
    return {
      route: 'manual_only',
      blockingReason: `O agendamento local esta desligado no grupo ${group.preferredSubject}. Reativa-o na pagina do grupo antes de mexer nesta agenda.`,
    };
  }

  if (!group.operationalSettings.allowLlmScheduling) {
    return {
      route: 'manual_only',
      blockingReason: `O grupo ${group.preferredSubject} continua com calendario manual, mas a LLM nao pode decidir scheduling aqui. Usa a vista semanal para editar manualmente ou reativa o LLM scheduling na pagina do grupo.`,
    };
  }

  return {
    route: 'schedule',
    blockingReason: null,
  };
}

function looksLikeDirectScheduleExecutionRequest(text: string): boolean {
  const normalisedText = normaliseTitleForMatch(text);

  if (
    /\b(agendar|cria|criar|marca|marcar|adiciona|adicionar|faz primeiro|faz isto|muda|mudar|altera|alterar|atualiza|atualizar|corrige|corrigir|mete|poe|cancela|cancelar|apaga|apagar|remove|remover)\b/u.test(
      normalisedText,
    )
  ) {
    return true;
  }

  if (/\bagenda\s+(isto|este|esta|desta|ja|a aula|o evento|o agendamento)\b/u.test(normalisedText)) {
    return true;
  }

  return /\blink\b/u.test(normalisedText) && /\b(vc|aula|agendamento|evento)\b/u.test(normalisedText);
}

function buildScheduleBatchReply(
  appliedResults: readonly AgentScheduleApplyResult[],
  blockedPreviews: readonly AgentScheduleApplyPreview[],
): string {
  if (appliedResults.length === 0) {
    return blockedPreviews[0]
      ? buildScheduleBlockedReply(blockedPreviews[0])
      : 'Ainda nao apliquei: nao consegui extrair um agendamento aplicavel deste pedido.';
  }

  if (appliedResults.length === 1 && blockedPreviews.length === 0) {
    return buildScheduleAppliedReply(appliedResults[0]);
  }

  const appliedSummary = appliedResults.map(summariseAppliedScheduleResult).filter(Boolean).slice(0, 5).join('; ');
  const blockedSummary =
    blockedPreviews.length > 0
      ? ` Nao apliquei ${blockedPreviews.length}: ${blockedPreviews.map((preview) => preview.blockingReason ?? 'bloqueado').join('; ')}.`
      : '';

  return `Feito: apliquei ${appliedResults.length} agendamento(s)${appliedSummary ? `: ${appliedSummary}` : ''}.${blockedSummary}`;
}

function buildScheduleAppliedReply(result: AgentScheduleApplyResult): string {
  const operation = result.preview.operation ?? 'create';

  if (operation === 'delete') {
    return `Feito: removi ${result.preview.targetEvent ? `"${result.preview.targetEvent.title}"` : 'o evento pedido'} da agenda.`;
  }

  if (result.appliedEvent) {
    const verb = operation === 'update' ? 'atualizei' : 'criei';
    const reminders = result.appliedEvent.notificationRuleLabels.length > 0
      ? ` Lembretes: ${result.appliedEvent.notificationRuleLabels.join(', ')}.`
      : '';
    return `Feito: ${verb} "${result.appliedEvent.title}" para ${result.appliedEvent.localDate} as ${result.appliedEvent.startTime}.${reminders}`;
  }

  return `Feito: ${result.preview.summary}`;
}

function summariseAppliedScheduleResult(result: AgentScheduleApplyResult): string {
  if (result.preview.operation === 'delete') {
    return result.preview.targetEvent?.title ?? 'evento removido';
  }

  if (!result.appliedEvent) {
    return result.preview.summary;
  }

  return `${result.appliedEvent.title} (${result.appliedEvent.localDate} ${result.appliedEvent.startTime})`;
}

function buildScheduleBlockedReply(preview: AgentScheduleApplyPreview): string {
  return `Ainda nao apliquei: ${preview.blockingReason ?? 'faltam dados para aplicar com seguranca'}. Diz so esse dado em falta e eu aplico.`;
}

function summariseContext(
  chatContext: AgentTurnResult['session']['chatContext'],
  memoryUsage: AgentMemoryUsage,
): readonly string[] {
  const conversationMessages = selectConversationContextMessages(chatContext.recentMessages);

  return [
    chatContext.group ? `grupo=${chatContext.group.preferredSubject}` : null,
    chatContext.activeReference ? `referente=${chatContext.activeReference.label}` : null,
    memoryUsage.scope === 'group'
      ? `memoria=${memoryUsage.groupLabel ?? memoryUsage.groupJid ?? 'grupo'}:${memoryUsage.instructionsSource ?? 'sem_fonte'}:${memoryUsage.knowledgeSnippetCount}_snippets`
      : null,
    `historico_recente_disponivel=${chatContext.recentMessages.length}`,
    `historico_recente_enviado=${conversationMessages.length}`,
    `historico_recente_politica=min${LLM_CONTEXT_MIN_MESSAGE_LIMIT}_max${LLM_CONTEXT_MAX_MESSAGE_LIMIT}_gap${Math.round(LLM_CONTEXT_CONTIGUOUS_GAP_MS / 60000)}min_margem${LLM_CONTEXT_TIMELINE_MARGIN_MESSAGES}`,
    ...conversationMessages.map((message, index) => summariseRecentMessageForPrompt(message, index)),
  ].filter((value): value is string => Boolean(value));
}

function selectConversationContextMessages(
  messages: AgentTurnResult['session']['chatContext']['recentMessages'],
): readonly AgentContextMessage[] {
  if (messages.length <= LLM_CONTEXT_MIN_MESSAGE_LIMIT) {
    return messages;
  }

  const newestIndex = messages.length - 1;
  let startIndex = Math.max(0, messages.length - LLM_CONTEXT_MIN_MESSAGE_LIMIT);

  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const nextMessage = messages[index + 1];
    const candidate = messages[index];

    if (newestIndex - index + 1 > LLM_CONTEXT_MAX_MESSAGE_LIMIT - LLM_CONTEXT_TIMELINE_MARGIN_MESSAGES) {
      break;
    }

    if (!areMessagesTimelineClose(candidate, nextMessage)) {
      break;
    }

    startIndex = index;
  }

  const marginStartIndex = Math.max(0, startIndex - LLM_CONTEXT_TIMELINE_MARGIN_MESSAGES);
  const selected = messages.slice(marginStartIndex);

  return selected.slice(Math.max(0, selected.length - LLM_CONTEXT_MAX_MESSAGE_LIMIT));
}

function areMessagesTimelineClose(
  olderMessage: AgentContextMessage,
  newerMessage: AgentContextMessage,
): boolean {
  const olderTimestamp = Date.parse(olderMessage.createdAt);
  const newerTimestamp = Date.parse(newerMessage.createdAt);

  if (!Number.isFinite(olderTimestamp) || !Number.isFinite(newerTimestamp)) {
    return false;
  }

  return newerTimestamp - olderTimestamp <= LLM_CONTEXT_CONTIGUOUS_GAP_MS;
}

function summariseRecentMessageForPrompt(
  message: AgentTurnResult['session']['chatContext']['recentMessages'][number],
  index: number,
): string {
  const sender = message.senderDisplayName?.trim() || message.personId?.trim() || message.role;
  const createdAt = message.createdAt?.trim() || 'sem_data';
  const text = truncatePromptLine(message.text.replace(/\s+/gu, ' ').trim(), LLM_CONTEXT_MESSAGE_MAX_LENGTH);
  return `historico_recente_${String(index + 1).padStart(2, '0')} timestamp=${createdAt} role=${message.role} sender=${sender} text=${text}`;
}

function truncatePromptLine(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
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
  weekSnapshot?: WeeklyPlannerSnapshot | null,
): readonly string[] {
  return [
    targetGroupJid ? `grupo_resolvido=${targetGroupJid}` : 'grupo_resolvido=indefinido',
    chatContext.activeReference ? `referente_ativo=${chatContext.activeReference.label}` : null,
    ...(weekSnapshot?.events ?? []).slice(0, 6).map((event) => `evento_semana=${event.title}:${event.localDate}:${event.startTime}`),
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
      instructionsContent: null,
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
    instructionsContent: chatContext.groupInstructions?.trim() || null,
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
  readonly instructionsContent?: string | null;
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
    instructionsContent: memoryUsage.instructionsContent,
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

function createBlockedSchedulePreview(input: {
  readonly requestText: string;
  readonly requestedAccessMode: CalendarAccessMode | null;
  readonly groupJid: string | null;
  readonly groupLabel: string | null;
  readonly weekId: string | null;
  readonly blockingReason: string;
}): AgentScheduleApplyPreview {
  return {
    requestText: input.requestText,
    requestedAccessMode: input.requestedAccessMode,
    groupJid: input.groupJid,
    groupLabel: input.groupLabel,
    weekId: input.weekId,
    previewFingerprint: null,
    operation: null,
    confidence: null,
    summary: 'Ainda nao foi possivel montar um preview aplicavel.',
    canApply: false,
    blockingReason: input.blockingReason,
    targetEvent: null,
    candidate: null,
    diff: [],
    parserNotes: [],
  };
}

function resolveScheduleOperation(text: string, targetEvent: WeeklyPlannerEventSummary | null): ScheduleApplyOperation {
  if (/\b(cancela|cancelar|apaga|apagar|remove|remover)\b/iu.test(text)) {
    return 'delete';
  }

  if (/\b(muda|mudar|mudou|altera|alterar|atualiza|atualizar|reagenda|reagendar|passa para|troca|trocar|adianta|adiar|fica\b)\b/iu.test(text) && targetEvent) {
    return 'update';
  }

  return targetEvent ? 'update' : 'create';
}

function resolveScheduleTargetEvent(
  text: string,
  candidate: LlmScheduleCandidate,
  events: readonly WeeklyPlannerEventSummary[],
): WeeklyPlannerEventSummary | null {
  if (events.length === 0) {
    return null;
  }

  const title = resolveCandidateTitle(candidate.title);
  const localDate = resolveLocalDateFromHint(candidate.dateHint, null);
  const startTime = normaliseTimeHint(candidate.timeHint);
  const titleMatches = title
    ? events.filter((event) => normaliseTitleForMatch(event.title) === normaliseTitleForMatch(title))
    : [];

  if (titleMatches.length === 1) {
    return titleMatches[0];
  }

  const dateMatches = localDate
    ? events.filter(
        (event) =>
          event.localDate === localDate &&
          (startTime ? event.startTime === startTime : true) &&
          (title ? normaliseTitleForMatch(event.title) === normaliseTitleForMatch(title) : true),
      )
    : [];

  if (dateMatches.length === 1) {
    return dateMatches[0];
  }

  if (/\b(cancela|cancelar|apaga|apagar|remove|remover|muda|mudar|altera|alterar|reagenda|reagendar)\b/iu.test(text)) {
    return titleMatches[0] ?? dateMatches[0] ?? (events.length === 1 ? events[0] : null);
  }

  return null;
}

function resolveCandidateTitle(title: string | null): string | null {
  if (!title?.trim()) {
    return null;
  }

  const normalised = title.trim();
  return GENERIC_CANDIDATE_TITLES.has(normaliseTitleForMatch(normalised)) ? null : normalised;
}

function normaliseTitleForMatch(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ');
}

function resolveLocalDateFromHint(dateHint: string | null, weekId: string | null, now = new Date()): string | null {
  if (!dateHint?.trim()) {
    return null;
  }

  const value = dateHint.trim();

  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return value;
  }

  const lower = normaliseTitleForMatch(value);

  if (lower === 'hoje') {
    return formatIsoDate(now);
  }

  if (lower === 'amanha' || lower === 'amanhã') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatIsoDate(tomorrow);
  }

  const dayIndex = DAY_LABEL_TO_INDEX.get(lower);

  if (dayIndex !== undefined && weekId) {
    return isoWeekDate(weekId, dayIndex);
  }

  return null;
}

function isoWeekDate(weekId: string, isoDayIndex: number): string | null {
  const match = /^(\d{4})-W(\d{2})$/u.exec(weekId.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const week = Number(match[2]);

  if (!Number.isFinite(year) || !Number.isFinite(week)) {
    return null;
  }

  const januaryFourth = new Date(Date.UTC(year, 0, 4, 12));
  const januaryFourthIsoDay = januaryFourth.getUTCDay() || 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthIsoDay + 1 + (week - 1) * 7 + (isoDayIndex - 1));

  return monday.toISOString().slice(0, 10);
}

function normaliseTimeHint(timeHint: string | null): string | null {
  if (!timeHint?.trim()) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/u.exec(timeHint.trim());

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseDurationMinutes(text: string): number | null {
  const match = /\b(\d{1,3})\s*(?:min|mins|minuto|minutos)\b/iu.exec(text);

  if (!match) {
    return null;
  }

  const duration = Number(match[1]);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function extractScheduleNotes(text: string): string | null {
  const match = /(?:nota(?:s)?|observa(?:cao|ção|coes|ções)|obs)\s*[:\-]\s*(.+)$/iu.exec(text);

  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  const url = extractFirstUrl(text);
  return url ? `Link: ${url}` : null;
}

function extractNotificationRulesFromRequest(text: string): readonly NotificationRuleDefinitionInput[] | null {
  const normalisedText = normaliseTitleForMatch(text);

  if (!/\b(lembrete|lembretes|alerta|alertas|aviso|avisos)\b/u.test(normalisedText)) {
    return null;
  }

  const rules: NotificationRuleDefinitionInput[] = [];
  const link = extractFirstUrl(text);
  const ownDayTime = extractFixedTimeAfter(normalisedText, ['proprio dia', 'mesmo dia', 'hoje']);
  const previousDayTime = extractFixedTimeAfter(normalisedText, ['dia anterior', 'dia antes', 'dia de antes', 'vespera']);
  const beforeMinutes = extractRelativeMinutes(normalisedText, 'antes');
  const afterMinutes = extractRelativeMinutes(normalisedText, 'depois') ?? extractPassedRelativeMinutes(normalisedText);

  if (ownDayTime) {
    rules.push({
      kind: 'fixed_local_time',
      daysBeforeEvent: 0,
      localTime: ownDayTime,
      enabled: true,
      label: `No proprio dia as ${ownDayTime}`,
      messageTemplate: 'Hoje temos {{event_title}} as {{event_time}}.',
      llmPromptTemplate:
        'Escreve um lembrete curto em portugues europeu para WhatsApp. Contexto: hoje o grupo {{group_label}} tem {{event_title}} as {{event_time}}.',
    });
  }

  if (previousDayTime) {
    rules.push({
      kind: 'fixed_local_time',
      daysBeforeEvent: 1,
      localTime: previousDayTime,
      enabled: true,
      label: `Dia anterior as ${previousDayTime}`,
      messageTemplate: 'Amanha temos {{event_title}} as {{event_time}}.',
      llmPromptTemplate:
        'Escreve um lembrete curto em portugues europeu para WhatsApp. Contexto: amanha o grupo {{group_label}} tem {{event_title}} as {{event_time}}.',
    });
  }

  if (beforeMinutes !== null) {
    rules.push({
      kind: 'relative_before_event',
      daysBeforeEvent: 0,
      offsetMinutesBeforeEvent: beforeMinutes,
      enabled: true,
      label: describeMinutesRule(beforeMinutes, 'antes'),
      messageTemplate: link
        ? `Daqui a {{minutes_until_event}} min temos {{event_title}}. Link: ${link}`
        : 'Daqui a {{minutes_until_event}} min temos {{event_title}}.',
      llmPromptTemplate: link
        ? `Escreve um ultimo lembrete curto em portugues europeu para WhatsApp. Contexto: faltam {{minutes_until_event}} minutos para {{event_title}} em {{event_datetime}} no grupo {{group_label}}. Inclui este link: ${link}`
        : 'Escreve um ultimo lembrete curto em portugues europeu para WhatsApp. Contexto: faltam {{minutes_until_event}} minutos para {{event_title}} em {{event_datetime}} no grupo {{group_label}}.',
    });
  }

  if (afterMinutes !== null) {
    const closesTest = /\b(fechar|fecha|encerra|termina).*\bteste\b|\bteste\b.*\b(fechar|fecha|encerra|termina)\b/u.test(
      normalisedText,
    );
    rules.push({
      kind: 'relative_after_event',
      offsetMinutesAfterEvent: afterMinutes,
      enabled: true,
      label: describeMinutesRule(afterMinutes, 'depois'),
      messageTemplate: closesTest
        ? 'Ultima oportunidade: o teste de {{event_title}} vai fechar.'
        : 'Ja passou {{minutes_since_event}} min desde {{event_title}}.',
      llmPromptTemplate: closesTest
        ? 'Escreve uma mensagem curta em portugues europeu para WhatsApp. Contexto: ja passou {{event_title}} em {{event_datetime}} no grupo {{group_label}} e o teste vai fechar. Escreve como ultima oportunidade.'
        : 'Escreve uma mensagem curta em portugues europeu para WhatsApp. Contexto: ja passaram {{minutes_since_event}} minutos desde {{event_title}} em {{event_datetime}} para o grupo {{group_label}}.',
    });
  }

  return rules.length > 0 ? rules : null;
}

function extractFirstUrl(text: string): string | null {
  const match = /https?:\/\/[^\s<>"')]+/iu.exec(text);
  return match?.[0] ?? null;
}

function extractFixedTimeAfter(text: string, anchors: readonly string[]): string | null {
  for (const anchor of anchors) {
    const index = text.indexOf(anchor);

    if (index < 0) {
      continue;
    }

    const afterAnchor = text.slice(index, index + 80);
    const time = normaliseLooseTime(afterAnchor);

    if (time) {
      return time;
    }
  }

  return null;
}

function extractRelativeMinutes(text: string, direction: 'antes' | 'depois'): number | null {
  const match = new RegExp(`\\b(\\d{1,3})\\s*(min|mins|minuto|minutos|h|hora|horas)\\s+${direction}\\b`, 'u').exec(text);

  if (!match) {
    return null;
  }

  return normaliseRelativeDuration(match[1], match[2]);
}

function extractPassedRelativeMinutes(text: string): number | null {
  const match = /\bpassad[oa]s?\s+(\d{1,3})\s*(min|mins|minuto|minutos|h|hora|horas)\b/u.exec(text);

  if (!match) {
    return null;
  }

  return normaliseRelativeDuration(match[1], match[2]);
}

function normaliseRelativeDuration(value: string, unit: string): number | null {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return /^h|hora/u.test(unit) ? amount * 60 : amount;
}

function normaliseLooseTime(text: string): string | null {
  const match = /\b(\d{1,2})(?::|h)(\d{2})?\b/u.exec(text);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function describeMinutesRule(minutes: number, direction: 'antes' | 'depois'): string {
  if (minutes % 60 === 0 && minutes >= 60) {
    return `${minutes / 60}h ${direction}`;
  }

  return `${minutes} min ${direction}`;
}

function buildScheduleDiff(
  operation: ScheduleApplyOperation,
  targetEvent: WeeklyPlannerEventSummary | null,
  candidate: {
    readonly title: string | null;
    readonly localDate: string | null;
    readonly dayLabel: string | null;
    readonly startTime: string | null;
    readonly durationMinutes: number | null;
    readonly notes: string | null;
  },
): readonly AgentScheduleDiffEntry[] {
  if (operation === 'delete') {
    return [
      {
        label: 'Evento',
        before: targetEvent ? summariseEvent(targetEvent) : null,
        after: 'Removido do calendario',
        changed: true,
      },
    ];
  }

  return [
    diffEntry('Titulo', targetEvent?.title ?? null, candidate.title),
    diffEntry('Data', targetEvent?.localDate ?? null, candidate.localDate),
    diffEntry('Hora', targetEvent?.startTime ?? null, candidate.startTime),
    diffEntry(
      'Duracao',
      targetEvent ? `${targetEvent.durationMinutes} min` : null,
      candidate.durationMinutes ? `${candidate.durationMinutes} min` : null,
    ),
    diffEntry('Notas', targetEvent?.notes || null, candidate.notes || null),
  ];
}

function diffEntry(label: string, before: string | null, after: string | null): AgentScheduleDiffEntry {
  return {
    label,
    before,
    after,
    changed: (before ?? '') !== (after ?? ''),
  };
}

function resolveScheduleBlockingReason(
  operation: ScheduleApplyOperation,
  targetEvent: WeeklyPlannerEventSummary | null,
  title: string | null,
  localDate: string | null,
  startTime: string | null,
  diff: readonly AgentScheduleDiffEntry[],
): string | null {
  if (operation === 'delete' && !targetEvent) {
    return 'Nao encontrei um evento claro para remover neste grupo.';
  }

  if (operation === 'update' && !targetEvent) {
    return 'Nao encontrei um evento claro para atualizar neste grupo.';
  }

  if (operation !== 'delete' && !title) {
    return 'Ainda falta um titulo claro para o evento.';
  }

  if (operation !== 'delete' && !localDate) {
    return 'Ainda falta uma data clara para conseguir aplicar o evento.';
  }

  if (operation !== 'delete' && !startTime) {
    return 'Ainda falta uma hora clara para conseguir aplicar o evento.';
  }

  if (operation === 'update' && !diff.some((entry) => entry.changed)) {
    return 'Nao detetei nenhuma diferenca funcional para atualizar neste evento.';
  }

  return null;
}

function buildSchedulePreviewSummary(
  operation: ScheduleApplyOperation,
  groupLabel: string | null,
  targetEvent: WeeklyPlannerEventSummary | null,
  candidate: {
    readonly title: string | null;
    readonly localDate: string | null;
    readonly startTime: string | null;
  },
): string {
  const label = groupLabel ?? 'este grupo';

  if (operation === 'delete') {
    return `Remover ${targetEvent ? `"${targetEvent.title}"` : 'o evento escolhido'} de ${label}.`;
  }

  if (operation === 'update') {
    return `Atualizar ${targetEvent ? `"${targetEvent.title}"` : 'o evento escolhido'} em ${label} para ${candidate.localDate ?? 'data por confirmar'} às ${candidate.startTime ?? 'hora por confirmar'}.`;
  }

  return `Criar "${candidate.title ?? 'novo evento'}" em ${label} para ${candidate.localDate ?? 'data por confirmar'} às ${candidate.startTime ?? 'hora por confirmar'}.`;
}

function summariseEvent(event: WeeklyPlannerEventSummary): string {
  return `${event.title} • ${event.localDate} • ${event.startTime}`;
}

function localDateToDayLabel(localDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(localDate)) {
    return null;
  }

  const date = new Date(`${localDate}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  switch (day) {
    case 1:
      return 'segunda-feira';
    case 2:
      return 'terca-feira';
    case 3:
      return 'quarta-feira';
    case 4:
      return 'quinta-feira';
    case 5:
      return 'sexta-feira';
    case 6:
      return 'sabado';
    case 7:
      return 'domingo';
    default:
      return null;
  }
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildScheduleApplyFingerprint(input: {
  readonly operation: ScheduleApplyOperation;
  readonly groupJid: string;
  readonly weekId: string;
  readonly targetEventId: string | null;
  readonly title: string | null;
  readonly localDate: string | null;
  readonly startTime: string | null;
  readonly durationMinutes: number;
  readonly notes: string | null;
  readonly requestText: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        operation: input.operation,
        groupJid: input.groupJid,
        weekId: input.weekId,
        targetEventId: input.targetEventId,
        title: input.title,
        localDate: input.localDate,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        notes: input.notes,
        requestText: input.requestText,
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

function buildScheduleApplyDedupeKey(payload: ScheduleApplyActionPayload): string {
  return [
    'assistant_schedule_apply',
    payload.groupJid,
    payload.operation,
    payload.targetEventId ?? 'new',
    payload.previewFingerprint,
  ].join(':');
}

function readAppliedEventFromInstruction(instruction: Instruction | null): WeeklyPlannerEventSummary | null {
  if (!instruction) {
    return null;
  }

  const action = instruction.actions.find((candidate) => candidate.type === 'schedule_apply');
  const appliedEvent = action?.result?.metadata?.appliedEvent;

  if (!appliedEvent || typeof appliedEvent !== 'object') {
    return null;
  }

  const event = appliedEvent as Partial<WeeklyPlannerEventSummary>;

  if (
    typeof event.eventId !== 'string' ||
    typeof event.weekId !== 'string' ||
    typeof event.groupJid !== 'string' ||
    typeof event.groupLabel !== 'string' ||
    typeof event.title !== 'string' ||
    typeof event.eventAt !== 'string' ||
    typeof event.localDate !== 'string' ||
    typeof event.dayLabel !== 'string' ||
    typeof event.startTime !== 'string' ||
    typeof event.durationMinutes !== 'number' ||
    typeof event.notes !== 'string'
  ) {
    return null;
  }

  return {
    eventId: event.eventId,
    weekId: event.weekId,
    groupJid: event.groupJid,
    groupLabel: event.groupLabel,
    title: event.title,
    eventAt: event.eventAt,
    localDate: event.localDate,
    dayLabel: event.dayLabel,
    startTime: event.startTime,
    durationMinutes: event.durationMinutes,
    notes: event.notes,
    notificationRuleLabels: Array.isArray(event.notificationRuleLabels) ? event.notificationRuleLabels : [],
    notifications:
      event.notifications && typeof event.notifications === 'object'
        ? {
            pending: Number(event.notifications.pending ?? 0),
            waitingConfirmation: Number(event.notifications.waitingConfirmation ?? 0),
            sent: Number(event.notifications.sent ?? 0),
            total: Number(event.notifications.total ?? 0),
          }
        : {
            pending: 0,
            waitingConfirmation: 0,
            sent: 0,
            total: 0,
          },
    nextReminderAt: typeof event.nextReminderAt === 'string' ? event.nextReminderAt : null,
    nextReminderLabel: typeof event.nextReminderLabel === 'string' ? event.nextReminderLabel : null,
    reminderLifecycle:
      event.reminderLifecycle && typeof event.reminderLifecycle === 'object'
        ? {
            generated: Number(event.reminderLifecycle.generated ?? 0),
            prepared: Number(event.reminderLifecycle.prepared ?? 0),
            sent: Number(event.reminderLifecycle.sent ?? 0),
          }
        : {
            generated: 0,
            prepared: 0,
            sent: 0,
          },
  };
}
