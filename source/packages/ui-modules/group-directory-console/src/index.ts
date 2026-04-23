import type { Group } from '@lume-hub/frontend-api-client';
import { createListSection, type UiPage } from '@lume-hub/shared-ui';

export interface GroupDirectoryConsoleUiModuleConfig {
  readonly route: string;
  readonly label: string;
}

export class GroupDirectoryConsoleUiModule {
  constructor(
    readonly config: GroupDirectoryConsoleUiModuleConfig = {
      route: '/groups',
      label: 'Grupos',
    },
  ) {}

  render(groups: readonly Group[]): UiPage<readonly Group[]> {
    return {
      route: this.config.route,
      title: this.config.label,
      description: 'Catalogo curto de grupos. Abre um grupo para gerir regras locais, lembretes e conhecimento.',
      sections: [
        createListSection(
          'Grupos',
          groups.map(
            (group) =>
              `${group.preferredSubject} | owners: ${group.groupOwners.map((owner) => owner.personId).join(', ') || 'nenhum'} | mode=${group.operationalSettings.mode} | scheduling=${group.operationalSettings.schedulingEnabled}`,
          ),
          'Sem grupos conhecidos.',
        ),
      ],
      data: groups,
    };
  }
}
