import type { WhatsAppWorkspaceSnapshot } from '@lume-hub/frontend-api-client';
import { createListSection, type UiPage } from '@lume-hub/shared-ui';

export interface WhatsAppConsoleUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class WhatsAppConsoleUiModule {
  constructor(
    readonly config: WhatsAppConsoleUiModuleConfig = {
      route: '/whatsapp',
      label: 'WhatsApp',
    },
  ) {}

  render(snapshot: WhatsAppWorkspaceSnapshot): UiPage<WhatsAppWorkspaceSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Configuracao do canal WhatsApp, grupos/conversas conhecidos e permissoes por pessoa e por grupo.',
      sections: [
        {
          title: 'Sessao',
          metrics: [
            {
              label: 'Enabled',
              value: snapshot.settings.whatsapp.enabled,
              tone: snapshot.settings.whatsapp.enabled ? 'positive' : 'warning',
            },
            {
              label: 'Auth',
              value: snapshot.host.authExists,
              tone: snapshot.host.authExists ? 'positive' : 'danger',
            },
            {
              label: 'Groups',
              value: `${snapshot.permissionSummary.authorizedGroups}/${snapshot.permissionSummary.knownGroups}`,
            },
            {
              label: 'Privates',
              value: `${snapshot.permissionSummary.authorizedPrivateConversations}/${snapshot.permissionSummary.knownPrivateConversations}`,
            },
          ],
          lines: [
            `shared_auth_with_codex=${snapshot.settings.whatsapp.sharedAuthWithCodex}`,
            `group_discovery=${snapshot.settings.whatsapp.groupDiscoveryEnabled}`,
            `conversation_discovery=${snapshot.settings.whatsapp.conversationDiscoveryEnabled}`,
            `auth_file=${snapshot.host.authFilePath}`,
            `canonical_auth_file=${snapshot.host.canonicalAuthFilePath ?? '-'}`,
            `same_as_codex=${snapshot.host.sameAsCodexCanonical}`,
            `autostart=${snapshot.host.autostartEnabled}`,
            `last_heartbeat=${snapshot.host.lastHeartbeatAt ?? 'never'}`,
          ],
        },
        createListSection(
          'Permissoes',
          [
            `assistant_enabled=${snapshot.settings.commands.assistantEnabled}`,
            `scheduling_enabled=${snapshot.settings.commands.schedulingEnabled}`,
            `owner_terminal_enabled=${snapshot.settings.commands.ownerTerminalEnabled}`,
            `auto_reply_enabled=${snapshot.settings.commands.autoReplyEnabled}`,
            `direct_replies_enabled=${snapshot.settings.commands.directRepliesEnabled}`,
            `allow_private_assistant=${snapshot.settings.commands.allowPrivateAssistant}`,
            `authorized_group_jids=${snapshot.settings.commands.authorizedGroupJids.join(', ') || 'all_known_groups'}`,
            `authorized_private_jids=${snapshot.settings.commands.authorizedPrivateJids.join(', ') || 'all_known_private_chats'}`,
          ],
          'Sem politica de permissoes.',
        ),
        createListSection(
          'App Owners',
          snapshot.appOwners.map(
            (person) =>
              `${person.displayName} | roles=${person.globalRoles.join(', ')} | jids=${person.whatsappJids.join(', ') || '-'} | owned_groups=${person.ownedGroupJids.join(', ') || '-'}`,
          ),
          'Sem app owners conhecidos.',
        ),
        createListSection(
          'Conversas Privadas',
          snapshot.conversations.map(
            (conversation) =>
              `${conversation.displayName} | jids=${conversation.whatsappJids.join(', ') || '-'} | roles=${conversation.globalRoles.join(', ')} | private_access=${conversation.privateAssistantAuthorized ? 'allowed' : 'blocked'} | owned_groups=${conversation.ownedGroupJids.join(', ') || '-'} | known=${conversation.knownToBot}`,
          ),
          'Sem conversas privadas conhecidas.',
        ),
        createListSection(
          'Grupos',
          snapshot.groups.map(
            (group) =>
              `${group.preferredSubject} | jid=${group.groupJid} | owners=${group.ownerLabels.join(', ') || 'nenhum'} | assistant_access=${group.assistantAuthorized ? 'allowed' : 'blocked'} | mode=${group.operationalSettings.mode} | scheduling=${group.operationalSettings.schedulingEnabled} | llm_scheduling=${group.operationalSettings.allowLlmScheduling} | member_tag_policy=${group.operationalSettings.memberTagPolicy} | acl: group=${group.calendarAccessPolicy.group}, owner=${group.calendarAccessPolicy.groupOwner}, app=${group.calendarAccessPolicy.appOwner} | known=${group.knownToBot}`,
          ),
          'Sem grupos conhecidos.',
        ),
      ],
      data: snapshot,
    };
  }
}
