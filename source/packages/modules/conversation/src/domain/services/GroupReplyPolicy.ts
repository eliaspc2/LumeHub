import type { CommandPolicyModuleContract } from '@lume-hub/command-policy';

import type { AgentAssistantTurnInput, AgentTurnResult } from '@lume-hub/agent-runtime';

export interface ReplyTargetDecision {
  readonly shouldReply: boolean;
  readonly targetChatType: 'group' | 'private' | null;
  readonly targetChatJid: string | null;
  readonly reason: string | null;
}

export class GroupReplyPolicy {
  constructor(
    private readonly commandPolicy: Pick<CommandPolicyModuleContract, 'canAutoReplyInGroup'>,
  ) {}

  async decide(input: AgentAssistantTurnInput, result: AgentTurnResult): Promise<ReplyTargetDecision> {
    if (!result.plan.allowReply || !result.replyText) {
      return {
        shouldReply: false,
        targetChatType: null,
        targetChatJid: null,
        reason: 'reply_suppressed',
      };
    }

    if (input.chatType === 'private') {
      return {
        shouldReply: true,
        targetChatType: 'private',
        targetChatJid: input.chatJid,
        reason: null,
      };
    }

    const canReplyInGroup =
      result.session.classification.intent === 'owner_command' ||
      result.session.classification.intent === 'fanout_request' ||
      (await this.commandPolicy.canAutoReplyInGroup(result.session.policyContext));

    if (canReplyInGroup) {
      return {
        shouldReply: true,
        targetChatType: 'group',
        targetChatJid: input.chatJid,
        reason: null,
      };
    }

    return {
      shouldReply: false,
      targetChatType: null,
      targetChatJid: null,
      reason: 'group_reply_not_permitted',
    };
  }
}
