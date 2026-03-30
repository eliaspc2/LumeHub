import type { CommandPolicySettings, PolicyActorContext } from '../entities/CommandPolicy.js';

export class GroupAuthorizationPolicy {
  isAuthorizedGroup(groupJid: string | null | undefined, settings: CommandPolicySettings): boolean {
    if (!groupJid) {
      return false;
    }

    return settings.authorizedGroupJids.length === 0 || settings.authorizedGroupJids.includes(groupJid);
  }

  isAuthorizedPrivateChat(chatJid: string | null | undefined, settings: CommandPolicySettings): boolean {
    if (!chatJid) {
      return false;
    }

    return settings.authorizedPrivateJids.length === 0 || settings.authorizedPrivateJids.includes(chatJid);
  }

  canAutoReply(context: PolicyActorContext, settings: CommandPolicySettings): boolean {
    if (!settings.autoReplyEnabled || !context.groupJid || !this.isAuthorizedGroup(context.groupJid, settings)) {
      return false;
    }

    return Boolean(context.wasTagged || settings.directRepliesEnabled);
  }
}
