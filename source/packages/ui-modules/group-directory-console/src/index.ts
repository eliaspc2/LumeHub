export interface GroupDirectoryConsoleUiModuleConfig {
  readonly route: string;
}

export class GroupDirectoryConsoleUiModule {
  constructor(readonly config: GroupDirectoryConsoleUiModuleConfig = { route: '/group-directory-console' }) {}
}
