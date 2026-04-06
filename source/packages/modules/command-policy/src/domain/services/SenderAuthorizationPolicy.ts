import type {
  CommandPolicySettings,
  PolicyAccessDecision,
  PolicyActorContext,
  PolicyActorRole,
} from '../entities/CommandPolicy.js';
import { GroupAuthorizationPolicy } from './GroupAuthorizationPolicy.js';
import { OwnerPolicy } from './OwnerPolicy.js';

export class SenderAuthorizationPolicy {
  constructor(
    private readonly ownerPolicy: OwnerPolicy,
    private readonly groupDirectory: {
      getOperationalSettings(groupJid: string): Promise<{
        readonly memberTagPolicy: 'members_can_tag' | 'owner_only';
      }>;
      isGroupOwner(groupJid: string, personId: string): Promise<boolean>;
    },
    private readonly groupPolicy = new GroupAuthorizationPolicy(),
  ) {}

  async canUseAssistant(context: PolicyActorContext, settings: CommandPolicySettings): Promise<boolean> {
    return (await this.explainAssistantAccess(context, settings)).allowed;
  }

  async canUseOwnerTerminal(personId: string | null, settings: CommandPolicySettings): Promise<boolean> {
    return settings.ownerTerminalEnabled && (await this.ownerPolicy.isAppOwner(personId));
  }

  async canAutoReplyInGroup(context: PolicyActorContext, settings: CommandPolicySettings): Promise<boolean> {
    return (await this.explainAutoReplyInGroup(context, settings)).allowed;
  }

  async explainAssistantAccess(
    context: PolicyActorContext,
    settings: CommandPolicySettings,
  ): Promise<PolicyAccessDecision> {
    const actorRole = await this.resolveActorRole(context);
    const interactionPolicy = await this.resolveInteractionPolicy(context.groupJid);

    if (actorRole === 'app_owner') {
      return this.buildDecision({
        allowed: true,
        actorRole,
        context,
        interactionPolicy,
        reasonCode: 'app_owner_override',
        summary: 'App owner pode dirigir o assistente neste chat, mesmo quando o grupo esta bloqueado para membros.',
      });
    }

    if (!settings.assistantEnabled) {
      return this.buildDecision({
        allowed: false,
        actorRole,
        context,
        interactionPolicy,
        reasonCode: 'assistant_disabled',
        summary: 'O assistente esta desligado globalmente.',
      });
    }

    if (context.chatType === 'private') {
      if (!settings.allowPrivateAssistant) {
        return this.buildDecision({
          allowed: false,
          actorRole,
          context,
          interactionPolicy: null,
          reasonCode: 'private_assistant_disabled',
          summary: 'O assistente em privado esta desligado.',
        });
      }

      if (!this.groupPolicy.isAuthorizedPrivateChat(context.chatJid, settings)) {
        return this.buildDecision({
          allowed: false,
          actorRole,
          context,
          interactionPolicy: null,
          reasonCode: 'private_chat_not_authorized',
          summary: 'Este contacto privado nao esta autorizado para falar com o assistente.',
        });
      }

      return this.buildDecision({
        allowed: true,
        actorRole,
        context,
        interactionPolicy: null,
        reasonCode: 'private_chat_authorized',
        summary: 'Este contacto pode falar com o assistente em privado.',
      });
    }

    if (!this.groupPolicy.isAuthorizedGroup(context.groupJid, settings)) {
      return this.buildDecision({
        allowed: false,
        actorRole,
        context,
        interactionPolicy,
        reasonCode: 'group_not_authorized',
        summary: 'Este grupo esta bloqueado para membros e owners locais.',
      });
    }

    if (actorRole === 'group_owner') {
      return this.buildDecision({
        allowed: true,
        actorRole,
        context,
        interactionPolicy,
        reasonCode: 'group_owner_allowed',
        summary: 'O owner do grupo pode dirigir o assistente aqui.',
      });
    }

    if (interactionPolicy === 'owner_only') {
      return this.buildDecision({
        allowed: false,
        actorRole,
        context,
        interactionPolicy,
        reasonCode: 'group_member_blocked_by_owner_policy',
        summary: 'Este grupo reserva o bot ao owner; membros nao podem dirigi-lo por tag.',
      });
    }

    return this.buildDecision({
      allowed: true,
      actorRole,
      context,
      interactionPolicy,
      reasonCode: 'group_member_allowed',
      summary: 'Qualquer membro pode dirigir o bot aqui por tag ou reply.',
    });
  }

  async explainAutoReplyInGroup(
    context: PolicyActorContext,
    settings: CommandPolicySettings,
  ): Promise<PolicyAccessDecision> {
    const assistantDecision = await this.explainAssistantAccess(context, settings);

    if (!assistantDecision.allowed) {
      return assistantDecision;
    }

    if (assistantDecision.actorRole === 'app_owner') {
      return this.buildDecision({
        allowed: true,
        actorRole: assistantDecision.actorRole,
        context,
        interactionPolicy: assistantDecision.interactionPolicy,
        reasonCode: 'app_owner_override',
        summary: 'App owner pode obter resposta imediata neste grupo.',
      });
    }

    if (!settings.autoReplyEnabled) {
      return this.buildDecision({
        allowed: false,
        actorRole: assistantDecision.actorRole,
        context,
        interactionPolicy: assistantDecision.interactionPolicy,
        reasonCode: 'group_auto_reply_disabled',
        summary: 'As respostas automaticas em grupos estao desligadas.',
      });
    }

    if (!this.groupPolicy.isAuthorizedGroup(context.groupJid, settings)) {
      return this.buildDecision({
        allowed: false,
        actorRole: assistantDecision.actorRole,
        context,
        interactionPolicy: assistantDecision.interactionPolicy,
        reasonCode: 'group_not_authorized',
        summary: 'Este grupo esta bloqueado para respostas automaticas.',
      });
    }

    if (!(context.wasTagged || context.isReplyToBot || settings.directRepliesEnabled)) {
      return this.buildDecision({
        allowed: false,
        actorRole: assistantDecision.actorRole,
        context,
        interactionPolicy: assistantDecision.interactionPolicy,
        reasonCode: 'group_auto_reply_requires_tag_or_reply',
        summary: 'Neste grupo o bot so responde quando e tagado ou quando estao a responder a uma mensagem dele.',
      });
    }

    return this.buildDecision({
      allowed: true,
      actorRole: assistantDecision.actorRole,
      context,
      interactionPolicy: assistantDecision.interactionPolicy,
      reasonCode: 'group_auto_reply_allowed',
      summary: assistantDecision.actorRole === 'group_owner'
        ? 'O owner do grupo pode chamar o bot aqui por tag ou reply.'
        : 'O bot pode responder neste grupo porque a interacao respeita a policy ativa.',
    });
  }

  private async resolveActorRole(context: PolicyActorContext): Promise<PolicyActorRole> {
    if (await this.ownerPolicy.isAppOwner(context.personId)) {
      return 'app_owner';
    }

    if (context.personId && context.groupJid && await this.groupDirectory.isGroupOwner(context.groupJid, context.personId)) {
      return 'group_owner';
    }

    return context.personId ? 'member' : 'unknown';
  }

  private async resolveInteractionPolicy(
    groupJid: string | null | undefined,
  ): Promise<'members_can_tag' | 'owner_only' | null> {
    if (!groupJid) {
      return null;
    }

    try {
      return (await this.groupDirectory.getOperationalSettings(groupJid)).memberTagPolicy;
    } catch {
      return 'members_can_tag';
    }
  }

  private buildDecision(input: {
    readonly allowed: boolean;
    readonly actorRole: PolicyActorRole;
    readonly context: PolicyActorContext;
    readonly interactionPolicy: 'members_can_tag' | 'owner_only' | null;
    readonly reasonCode: string;
    readonly summary: string;
  }): PolicyAccessDecision {
    return {
      allowed: input.allowed,
      actorRole: input.actorRole,
      chatType: input.context.chatType ?? (input.context.groupJid ? 'group' : 'private'),
      groupJid: input.context.groupJid?.trim() || null,
      interactionPolicy: input.interactionPolicy,
      reasonCode: input.reasonCode,
      summary: input.summary,
    };
  }
}
