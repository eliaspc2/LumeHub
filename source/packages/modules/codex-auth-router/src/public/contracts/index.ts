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
  setEnabled(enabled: boolean): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
  getStatus(): Promise<import('../../domain/entities/CodexAuthRouter.js').CodexAuthRouterStatus>;
}
