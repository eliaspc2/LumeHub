export interface CodexAuthRouterModuleContract {
  readonly moduleName: 'codex-auth-router';

  prepareAuthForRequest(
    input?: import('../../domain/entities/CodexAuthRouter.js').PrepareAuthForRequestInput,
  ): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAccountSelection>;
  reportSuccess(
    input?: import('../../domain/entities/CodexAuthRouter.js').ReportCodexAuthSuccessInput,
  ): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
  reportFailure(
    input: import('../../domain/entities/CodexAuthRouter.js').ReportCodexAuthFailureInput,
  ): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
  forceSwitch(
    accountId: string,
    input?: import('../../domain/entities/CodexAuthRouter.js').ForceCodexAuthSwitchInput,
  ): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAccountSelection>;
  importAccount(
    input: import('../../domain/entities/CodexAuthRouter.js').ImportCodexAuthAccountInput,
  ): Promise<import('../../domain/entities/CodexAuthRouter.js').ImportedCodexAuthAccount>;
  renameAccount(
    input: import('../../domain/entities/CodexAuthRouter.js').RenameCodexAuthAccountInput,
  ): Promise<import('../../domain/entities/CodexAuthRouter.js').RenamedCodexAuthAccount>;
  updateAccountRoutingTier(
    accountId: string,
    routingTier: import('../../domain/entities/CodexAuthRouter.js').CodexRoutingTier,
  ): Promise<import('../../domain/entities/CodexAuthRouter.js').DiscoveredCodexAccountSource>;
  removeAccount(accountId: string): Promise<import('../../domain/entities/CodexAuthRouter.js').RemovedCodexAuthAccount>;
  setEnabled(enabled: boolean): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
  getStatus(): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
  refreshStatus(): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
  refreshAccountQuota(accountId: string): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
}
