import type { CommandPolicySettings, PolicyActorContext } from '../entities/CommandPolicy.js';
import { GroupAuthorizationPolicy } from './GroupAuthorizationPolicy.js';
import { OwnerPolicy } from './OwnerPolicy.js';

export class SenderAuthorizationPolicy {
  constructor(
    private readonly ownerPolicy: OwnerPolicy,
    private readonly groupPolicy = new GroupAuthorizationPolicy(),
  ) {}

  async canUseAssistant(context: PolicyActorContext, settings: CommandPolicySettings): Promise<boolean> {
    if (await this.ownerPolicy.isAppOwner(context.personId)) {
      return true;
    }

    if (!settings.assistantEnabled) {
      return false;
    }

    if (context.chatType === 'private') {
      return settings.allowPrivateAssistant && this.groupPolicy.isAuthorizedPrivateChat(context.chatJid, settings);
    }

    return this.groupPolicy.isAuthorizedGroup(context.groupJid, settings);
  }

  async canUseOwnerTerminal(personId: string | null, settings: CommandPolicySettings): Promise<boolean> {
    return settings.ownerTerminalEnabled && (await this.ownerPolicy.isAppOwner(personId));
  }

  async canAutoReplyInGroup(context: PolicyActorContext, settings: CommandPolicySettings): Promise<boolean> {
    if (await this.ownerPolicy.isAppOwner(context.personId)) {
      return true;
    }

    return this.groupPolicy.canAutoReply(context, settings);
  }
}
