import type { IntentClassification } from '@lume-hub/intent-classifier';

import type { AgentExecutionPlan, AgentReplyMode, AgentSessionContext } from '../entities/AgentRuntime.js';

export class AgentDecisionService {
  buildInitialPlan(classification: IntentClassification, assistantAllowed: boolean): AgentExecutionPlan {
    if (classification.intent === 'owner_command') {
      return {
        intent: classification.intent,
        selectedTools: ['owner_command'],
        allowReply: true,
        replyMode: 'same_chat',
        notes: ['owner_command_detected'],
      };
    }

    if (!assistantAllowed) {
      return {
        intent: classification.intent,
        selectedTools: [],
        allowReply: false,
        replyMode: 'silent',
        notes: ['assistant_not_allowed'],
      };
    }

    switch (classification.intent) {
      case 'fanout_request':
        return {
          intent: classification.intent,
          selectedTools: ['fanout_preview', 'chat_reply'],
          allowReply: true,
          replyMode: 'same_chat',
          notes: ['fanout_preview_required'],
        };
      case 'scheduling_request':
        return {
          intent: classification.intent,
          selectedTools:
            classification.requestedAccessMode === 'read_write'
              ? ['schedule_parse', 'schedule_apply', 'chat_reply']
              : ['schedule_parse', 'chat_reply'],
          allowReply: true,
          replyMode: 'same_chat',
          notes:
            classification.requestedAccessMode === 'read_write'
              ? ['schedule_parse_required', 'schedule_apply_available']
              : ['schedule_parse_required'],
        };
      case 'local_summary_request':
      case 'operational_instruction':
      case 'casual_chat':
      case 'unknown':
      default:
        return {
          intent: classification.intent,
          selectedTools: ['chat_reply'],
          allowReply: true,
          replyMode: 'same_chat',
          notes: classification.intent === 'unknown' ? ['fallback_chat_reply'] : [],
        };
    }
  }

  withAdditionalNote(plan: AgentExecutionPlan, note: string): AgentExecutionPlan {
    return {
      ...plan,
      notes: [...plan.notes, note],
    };
  }

  withAdditionalTool(plan: AgentExecutionPlan, toolName: AgentExecutionPlan['selectedTools'][number]): AgentExecutionPlan {
    return {
      ...plan,
      selectedTools: [...new Set([...plan.selectedTools, toolName])],
    };
  }

  changeReplyMode(plan: AgentExecutionPlan, replyMode: AgentReplyMode): AgentExecutionPlan {
    return {
      ...plan,
      replyMode,
    };
  }

  createSession(
    classification: IntentClassification,
    assistantAllowed: boolean,
    policyContext: AgentSessionContext['policyContext'],
    chatContext: AgentSessionContext['chatContext'],
    schedulingContext: AgentSessionContext['schedulingContext'],
  ): AgentSessionContext {
    return {
      classification,
      assistantAllowed,
      policyContext,
      chatContext,
      schedulingContext,
    };
  }
}
