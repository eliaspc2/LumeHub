import type { SettingsSnapshot } from '@lume-hub/frontend-api-client';
import { createListSection, type UiPage } from '@lume-hub/shared-ui';

export interface SettingsCenterUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class SettingsCenterUiModule {
  constructor(
    readonly config: SettingsCenterUiModuleConfig = {
      route: '/settings',
      label: 'Settings',
    },
  ) {}

  render(snapshot: SettingsSnapshot): UiPage<SettingsSnapshot> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Configuracao operacional: avisos default, anti-sleep e autostart.',
      sections: [
        createListSection(
          'Avisos Default',
          snapshot.adminSettings.ui.defaultNotificationRules.map(
            (rule) =>
              `${rule.kind} | days=${rule.daysBeforeEvent ?? '-'} | offset=${rule.offsetMinutesBeforeEvent ?? '-'} | localTime=${rule.localTime ?? '-'} | enabled=${rule.enabled ?? true}`,
          ),
          'Sem avisos default definidos.',
        ),
        {
          title: 'Energia',
          metrics: [
            {
              label: 'Mode',
              value: snapshot.powerStatus.policy.mode,
            },
            {
              label: 'Inhibitor',
              value: snapshot.powerStatus.inhibitorActive,
              tone: snapshot.powerStatus.inhibitorActive ? 'warning' : 'neutral',
            },
          ],
          lines: [
            `enabled=${snapshot.powerStatus.policy.enabled}`,
            `reasons=${snapshot.powerStatus.reasons.join(', ') || '-'}`,
            snapshot.powerStatus.explanation,
          ],
        },
        createListSection(
          'Host',
          [
            `autostart=${snapshot.hostStatus.autostart.enabled}`,
            `auth_exists=${snapshot.hostStatus.auth.exists}`,
            `same_as_codex=${snapshot.hostStatus.auth.sameAsCodexCanonical}`,
            `heartbeat=${snapshot.hostStatus.runtime.lastHeartbeatAt ?? 'never'}`,
          ],
          'Sem estado do host.',
        ),
      ],
      data: snapshot,
    };
  }
}
