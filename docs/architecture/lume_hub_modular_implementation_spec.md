# Lume Hub Modular Implementation Spec

Este ficheiro descreve como implementar o projeto de raiz com arquitetura modular, orientada a objetos, portavel e preparada para desenvolvimento paralelo.

Este documento complementa:
- [lume_hub_rewrite_master_prompt.md](/home/eliaspc/Documentos/Instruction/KubuntuLTS/lume_hub_rewrite_master_prompt.md)

Se o ficheiro `lume_hub_rewrite_master_prompt.md` diz o que o sistema deve ser, este ficheiro diz como o sistema deve ser montado em disco, em código e por equipas.

## Objetivo desta arquitetura

Quero uma arquitetura:

1. totalmente modular
2. orientada a objetos
3. desacoplada por contratos
4. com cada modulo na sua propria sub-pasta
5. com cada modulo potencialmente reutilizavel noutro projeto
6. com possibilidade real de desenvolvimento em paralelo
7. que use bibliotecas externas maduras quando isso reduz risco
8. que evite reinventar o que ja existe e esta bom

## Escolha estrutural principal

### Decisao: monorepo por workspaces

O projeto deve ser implementado como monorepo com `pnpm workspaces`.

Razao:
- permite separar cada modulo em package propria
- facilita desenvolvimento paralelo
- facilita testes isolados por modulo
- facilita publicar/reutilizar modulos
- evita um `src/` monolitico gigante

### Ferramentas base a descarregar

Usar apenas fontes oficiais ou canonical upstream.

1. `Node.js LTS`
   - descarregar de: [nodejs.org](https://nodejs.org/en/download/)
2. `pnpm`
   - documentacao e download: [pnpm.io](https://pnpm.io/)
3. `Fastify`
   - documentacao: [fastify.dev](https://fastify.dev/docs/latest/)
4. `@fastify/websocket`
   - upstream oficial: [GitHub fastify-websocket](https://github.com/fastify/fastify-websocket)
5. `Pino`
   - upstream oficial: [npm pino](https://www.npmjs.com/package/pino)
6. `Zod`
   - upstream oficial: [zod.dev](https://zod.dev/)
7. `Baileys`
   - upstream oficial: [npm baileys](https://www.npmjs.com/package/baileys)
   - repositorio: [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys)
8. `better-sqlite3`
   - opcional para indices/analytics futuros; nao e storage canonico
   - upstream oficial: [npm better-sqlite3](https://www.npmjs.com/package/better-sqlite3)
9. `Kysely`
   - opcional para indices/analytics futuros; nao e storage canonico
   - documentacao oficial: [kysely.dev](https://www.kysely.dev/)
10. `Vitest`
   - documentacao oficial: [vitest.dev](https://vitest.dev/)
11. `Vite` + `@vitejs/plugin-react`
   - documentacao oficial: [vite.dev/plugins](https://vite.dev/plugins/)
12. `TanStack Query`
   - documentacao oficial: [tanstack.com/query](https://tanstack.com/query/latest/docs/react/)
13. `Playwright`
   - documentacao oficial: [playwright.dev](https://playwright.dev/docs/api/class-playwright)

## Regras de dependencia externa

1. Instalar sempre o package oficial, nunca forks obscuros.
2. Fixar major/minor com criterio.
3. Ter um ficheiro `docs/upstream-dependencies.md` com:
   - package
   - fonte oficial
   - porque foi escolhido
   - risco de lock-in
4. Nunca espalhar chamadas diretas a bibliotecas externas por muitos modulos.
5. Toda dependencia externa relevante deve ficar atras de um adapter local.

## Estrutura ideal em disco

```text
lume-hub/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .editorconfig
  .gitignore
  README.md
  docs/
    architecture/
    decisions/
    upstream-dependencies.md
    api/
  apps/
    lume-hub-backend/
      package.json
      tsconfig.json
      src/
        main.ts
        bootstrap/
          AppBootstrap.ts
          ModuleLoader.ts
          RuntimeBuilder.ts
          ShutdownCoordinator.ts
      tests/
    lume-hub-host/
      package.json
      tsconfig.json
      src/
        main.ts
        bootstrap/
          HostBootstrap.ts
          HostModuleLoader.ts
      tests/
    lume-hub-web/
      package.json
      tsconfig.json
      vite.config.ts
      src/
        main.tsx
        app/
        shell/
      tests/
  packages/
    foundation/
      kernel/
      config/
      logging/
      events/
      clock/
      identity/
      errors/
      test-kit/
      contracts/
    adapters/
      http-fastify/
      ws-fastify/
      whatsapp-baileys/
      persistence-group-files/
      llm-codex-oauth/
      llm-openai-compat/
      frontend-api-client/
    modules/
      admin-config/
      group-directory/
      audience-routing/
      discipline-catalog/
      people-memory/
      codex-auth-router/
      schedule-weeks/
      schedule-events/
      notification-rules/
      notification-jobs/
      delivery-tracker/
      instruction-queue/
      weekly-planner/
      command-policy/
      intent-classifier/
      assistant-context/
      llm-orchestrator/
      agent-runtime/
      conversation/
      owner-control/
      alerts/
      automations/
      watchdog/
      health-monitor/
      system-power/
      host-lifecycle/
    ui-modules/
      dashboard/
      week-planner/
      assistant-console/
      delivery-monitor/
      watchdog-inbox/
      queue-console/
      group-directory-console/
      settings-center/
      shared-ui/
```

## Template obrigatorio de cada modulo

Cada modulo deve seguir exatamente esta forma:

```text
packages/modules/<module-name>/
  package.json
  tsconfig.json
  README.md
  src/
    public/
      index.ts
      contracts/
    application/
      services/
      use-cases/
      dto/
      factories/
    domain/
      entities/
      value-objects/
      policies/
      events/
      repositories/
      services/
    infrastructure/
      persistence/
      adapters/
      mappers/
    module/
      <ModuleName>Module.ts
      <ModuleName>ModuleFactory.ts
      <ModuleName>ModuleConfig.ts
  tests/
    unit/
    integration/
```

## Convenção POO obrigatoria

Cada modulo deve expor:

1. uma classe `*Module`
2. uma classe `*ModuleFactory`
3. uma `public API` pequena e clara
4. interfaces de repositorio e portas em `domain/` ou `public/contracts`
5. adapters concretos em `infrastructure/`

### Classes base recomendadas

Em `packages/foundation/kernel`:

- `BaseModule`
- `ModuleContext`
- `ModuleManifest`
- `ModuleDependency`
- `ModuleLoader`
- `ApplicationKernel`
- `RuntimeRegistry`
- `Startable`
- `Stoppable`
- `HealthCheckCapable`

### Contrato base de modulo

Cada modulo deve implementar algo deste genero:

```ts
export interface IModule {
  readonly name: string;
  readonly manifest: ModuleManifest;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<ModuleHealth>;
}
```

### Regra de encapsulamento

Um modulo nunca importa implementacao concreta de outro modulo.
Importa apenas:
- contratos publicos
- DTOs publicos
- interfaces

## Estrutura dos packages foundation

### `packages/foundation/kernel`

Responsabilidade:
- kernel aplicacional
- bootstrap
- lifecycle
- registry de modulos

Classes:
- `ApplicationKernel`
- `ModuleLoader`
- `ModuleRegistry`
- `ModuleContext`
- `RuntimeDependencyContainer`
- `ShutdownCoordinator`

Implementacao:
- `ApplicationKernel` recebe manifests
- resolve ordem por dependencias
- instancia modulos via factories
- chama `start()` pela ordem correta
- chama `stop()` em ordem inversa

### `packages/foundation/config`

Responsabilidade:
- carregamento e validacao de configuracao

Classes:
- `EnvironmentConfigLoader`
- `FileConfigLoader`
- `ConfigResolver`
- `ConfigValidator`
- `AppConfig`

Implementacao:
- Zod para schema
- nenhum `process.env` fora daqui
- config imutavel

### `packages/foundation/logging`

Responsabilidade:
- logger estruturado
- audit logger

Classes:
- `LoggerFactory`
- `ModuleLogger`
- `AuditLogger`
- `LogContextBuilder`

Implementacao:
- usar `pino`
- criar child logger por modulo
- suportar `info/warn/error/debug`

### `packages/foundation/events`

Responsabilidade:
- event bus interno

Classes:
- `DomainEventBus`
- `InMemoryEventBus`
- `EventSubscriptionRegistry`

Implementacao:
- EventEmitter interno ou implementacao propria fina
- API typed
- sem logica de negocio

### `packages/foundation/clock`

Responsabilidade:
- abstrair tempo

Classes:
- `SystemClock`
- `FakeClock`

Implementacao:
- toda logica temporal depende desta abstracao
- crucial para testes do scheduler

### `packages/foundation/contracts`

Responsabilidade:
- DTOs e contratos transversais

Conteudo:
- `WeekId`
- `GroupId`
- `PersonId`
- `EventId`
- `NotificationJobId`
- `InstructionId`
- `DeliveryAttemptId`
- `ModuleHealth`
- `Pagination`

## Estrutura dos packages adapters

### `packages/adapters/persistence-group-files`

Responsabilidade:
- storage canonico por pastas de grupo e calendarios mensais
- lock de escrita
- leitura/escrita atomica
- schema validation

Bibliotecas:
- `node:fs`
- `node:path`
- `zod`

Classes:
- `GroupWorkspaceRepository`
- `GroupCalendarFileRepository`
- `GroupFileLockManager`
- `AtomicJsonWriter`
- `GroupCalendarSchemaValidator`
- `GroupPathResolver`
- `WeeklyProjectionBuilder`

Implementacao:
- o layout canonico deve ser tipo:
  - `data/groups/_settings.json`
  - `data/groups/<jid>/group.json`
  - `data/groups/<jid>/llm/instructions.md`
  - `data/groups/<jid>/policy.json`
  - `data/groups/<jid>/calendar/2026-03.json`
  - `data/groups/<jid>/views/w13y2026.view.json`
- a fronteira canonica do ficheiro deve ser grupo + mes
- `week_id` e derivado do numero ISO oficial e vive dentro de cada evento/job
- projections semanais por ISO week podem existir para operacao, UI e watchdog
- nao ter storage paralela concorrente como fonte de verdade
- se existir indice secundario no futuro, ele nunca substitui os ficheiros do grupo como canone

Razao para esta escolha:
- cada grupo passa a ter o seu proprio workspace natural
- com `20-25` agendamentos por grupo, o mes continua leve e legivel
- evita cortes artificiais de quinzena
- mantem `week_id` como chave operacional forte

### `packages/adapters/whatsapp-baileys`

Responsabilidade:
- adapter Baileys

Biblioteca:
- `@whiskeysockets/baileys`

Classes:
- `BaileysWhatsAppGateway`
- `BaileysSessionStore`
- `InboundMessageNormalizer`
- `OutboundConfirmationTracker`
- `GroupMetadataCache`
- `BaileysReconnectPolicy`

Implementacao:
- tudo o que toca na Baileys fica aqui
- expor apenas portas do projeto:
  - `IWhatsAppGateway`
  - `IGroupMetadataProvider`
  - `IOutboundSignalSource`

### `packages/adapters/http-fastify`

Responsabilidade:
- HTTP API

Biblioteca:
- `Fastify`

Classes:
- `FastifyHttpServer`
- `RouteRegistrar`
- `RequestContextFactory`
- `ApiErrorHandler`

Implementacao:
- controllers finos por use case
- usar plugins oficiais `@fastify/*` quando fizer sentido

### `packages/adapters/ws-fastify`

Responsabilidade:
- WebSocket server

Biblioteca:
- `@fastify/websocket`

Classes:
- `WebSocketGateway`
- `WebSocketSessionRegistry`
- `UiEventPublisher`

### `packages/adapters/llm-codex-oauth`

Responsabilidade:
- provider Codex OAuth

Classes:
- `CodexOAuthClient`
- `CodexOAuthStreamingParser`
- `CodexModelsCatalogClient`

Implementacao:
- ler o auth do ficheiro canonico escolhido
- chamar `chatgpt.com/backend-api/codex/responses`
- listar modelos via `.../codex/models`

### `packages/adapters/llm-openai-compat`

Responsabilidade:
- fallback compativel OpenAI

Classes:
- `OpenAiCompatClient`
- `OpenAiModelsClient`

### `packages/adapters/frontend-api-client`

Responsabilidade:
- client typed do frontend para a API

Implementacao:
- gerar tipos de OpenAPI quando possível
- wrappers OO por recurso

## Estrutura dos packages modules

## 1. `admin-config`

Responsabilidade:
- gerir configuracao alteravel em runtime

Classes:
- `AdminConfigModule`
- `AdminConfigService`
- `AdminConfigRepository`
- `CommandsPolicySettings`
- `LlmRuntimeSettings`

Fonte de informacao:
- DB `system_settings`

Contrato publico:
- `getSettings()`
- `updateCommandsSettings()`
- `updateLlmSettings()`
- `updateUiSettings()`

Paralelizavel com:
- frontend `settings-center`
- command-policy
- llm-orchestrator

## 2. `group-directory`

Responsabilidade:
- catalogar grupos, aliases, ownership local e policy de acesso ao calendario
- localizar o workspace persistente de cada grupo
- expor prompt e policy especificos do grupo

Classes:
- `GroupDirectoryModule`
- `GroupDirectoryService`
- `GroupRepository`
- `GroupAliasRepository`
- `GroupResolver`
- `GroupWorkspaceLocator`
- `GroupPromptRepository`
- `GroupPolicyRepository`

Entidades:
- `Group`
- `GroupAlias`
- `GroupOwnerAssignment`
- `GroupCalendarAccessPolicy`
- `CalendarAccessMode`

Fonte:
- WhatsApp metadata
- config/catalogo de cursos
- `data/groups/<jid>/`

Contrato publico:
- `findByJid()`
- `findBySubject()`
- `findByAlias()`
- `refreshFromWhatsApp()`
- `getGroupOwners()`
- `getCalendarAccessPolicy()`
- `getGroupWorkspace()`
- `getGroupLlmInstructions()`
- `getGroupPolicy()`

## 2A. `audience-routing`

Responsabilidade:
- resolver destinatarios multi-grupo a partir de pessoa/remetente
- manter regras declarativas de fan-out
- produzir preview/plano de distribuicao antes do envio

Classes:
- `AudienceRoutingModule`
- `AudienceRoutingService`
- `SenderAudienceRepository`
- `DistributionPlanBuilder`
- `FanOutPolicyEvaluator`

Entidades:
- `SenderAudienceRule`
- `DistributionPlan`
- `DistributionTarget`

Fonte:
- `people-memory`
- `group-directory`
- `discipline-catalog`
- configuracao administrativa

Contrato publico:
- `resolveTargetsForSender()`
- `previewDistributionPlan()`
- `upsertSenderAudienceRule()`
- `listSenderAudienceRules()`

## 3. `discipline-catalog`

Responsabilidade:
- mapear disciplina para curso e grupo

Classes:
- `DisciplineCatalogModule`
- `DisciplineCatalogService`
- `DisciplineCatalogLoader`
- `DisciplineMatcher`

Entidades:
- `CourseChannel`
- `DisciplineEntry`

Fonte:
- `config/discipline_catalog.json`

Implementacao:
- o ficheiro JSON deve ser carregado e validado por schema
- permitir reload

Contrato publico:
- `findByCode()`
- `findFromText()`
- `listCourses()`
- `listDisciplines()`

## 4. `people-memory`

Responsabilidade:
- identidade amigavel e memoria importante

Classes:
- `PeopleMemoryModule`
- `PeopleDirectoryService`
- `PeopleRepository`
- `PersonIdentityMatcher`
- `ImportantMemoryService`

Entidades:
- `Person`
- `PersonIdentifier`
- `PersonNote`

Fonte:
- DB `people`, `people_notes`

Contrato publico:
- `findByIdentifiers()`
- `upsertByIdentifiers()`
- `appendImportantNote()`

## 5. `codex-auth-router`

Responsabilidade:
- conta OAuth ativa e balancing
- ownership do mesmo ficheiro OAuth live usado pelo CLI do Codex

Classes:
- `CodexAuthRouterModule`
- `CodexAuthRouterService`
- `CodexAccountRepository`
- `CodexAccountUsageService`
- `CodexAuthCanonicalWriter`
- `CodexAccountScorer`
- `CodexAccountSwitchPolicy`

Entidades:
- `CodexAccount`
- `CodexUsageSnapshot`
- `CodexAccountSelection`

Fontes:
- ficheiro canonico `/codex/auth.json`
- replicas secundarias
- DB de contas/usage
- endpoint de usage

Contrato publico:
- `prepareAuthForRequest()`
- `reportSuccess()`
- `reportFailure()`
- `forceSwitch()`
- `getStatus()`

Regra de implementacao:
- este modulo nasce logo no MVP
- nao e opcional
- o ficheiro live gerido por este modulo e o mesmo que o Codex CLI usa, nao uma copia privada do projeto
- a troca do ficheiro live deve ser atomica, auditavel e reversivel

## 6. `schedule-weeks`

Responsabilidade:
- modelar semana ISO como agregado

Classes:
- `ScheduleWeeksModule`
- `ScheduleWeekService`
- `ScheduleWeekRepository`
- `WeekCalculator`
- `WeekProjectionService`

Entidades:
- `ScheduleWeek`
- `WeekRange`

Fonte:
- calendarios canonicos por grupo e por mes

Contrato publico:
- `getWeek(weekId)`
- `getCurrentWeek()`
- `listWeeks()`
- `ensureWeekForDate()`
- `readWeekFile()`

## 7. `schedule-events`

Responsabilidade:
- eventos base

Classes:
- `ScheduleEventsModule`
- `ScheduleEventService`
- `ScheduleEventRepository`
- `ScheduleEventFactory`
- `ScheduleEventMutator`
- `CalendarAccessPolicy`

Entidades:
- `ScheduleEvent`
- `EventKind`
- `EventTarget`
- `CalendarAccessLevel`
- `CalendarAccessMode`

Fonte:
- ficheiro mensal do respetivo grupo

Contrato publico:
- `createEvent()`
- `updateEvent()`
- `deleteEvent()`
- `listEventsByWeek()`
- `findEventById()`
- `assertCalendarAccess(requiredMode)`

Nota de modelacao:
- um evento e sempre o objeto principal
- nao usar notificacoes como substituto do evento

## 8. `notification-rules`

Responsabilidade:
- regras derivadas do evento
- numero variavel de avisos por evento

Classes:
- `NotificationRulesModule`
- `NotificationRuleService`
- `NotificationRuleRepository`
- `NotificationRulePolicyEngine`

Entidades:
- `NotificationRule`
- `NotificationRuleKind`

Tipos minimos:
- `relative_before_event`
- `fixed_local_time`

Contrato publico:
- `deriveRulesForEvent()`
- `replaceRulesForEvent()`
- `listRulesForEvent()`

Regras obrigatorias:
- o numero de avisos tem de ser variavel
- o default do sistema deve ser:
  - `24h antes`
  - `30 min antes`
- o sistema deve permitir aviso de horario fixo, por exemplo `dia anterior as 20:00`

## 9. `notification-jobs`

Responsabilidade:
- jobs concretos de envio

Classes:
- `NotificationJobsModule`
- `NotificationJobService`
- `NotificationJobRepository`
- `NotificationJobMaterializer`

Entidades:
- `NotificationJob`
- `NotificationJobStatus`

Fonte:
- ficheiro mensal do respetivo grupo

Contrato publico:
- `materializeForEvent()`
- `listPendingJobs()`
- `markSuppressed()`
- `markDisabled()`

Regra:
- `pre30m` e job derivado, nao clone solto
- estados visiveis do envio:
  - `pending`
  - `waiting_confirmation`
  - `sent`
- quando `eventAt` passar, jobs ja concluidos devem ser removidos por politica de cleanup

## 10. `delivery-tracker`

Responsabilidade:
- reconciliar tentativas e sinais outbound

Classes:
- `DeliveryTrackerModule`
- `DeliveryTrackerService`
- `DeliveryAttemptRepository`
- `OutboundSignalReconciler`
- `DeliveryResolutionPolicy`

Entidades:
- `DeliveryAttempt`
- `OutboundObservation`
- `OutboundConfirmation`

Fonte:
- ficheiro mensal do respetivo grupo
- eventos do WhatsApp

Contrato publico:
- `registerAttemptStarted()`
- `registerObservation()`
- `registerConfirmation()`
- `resolvePendingAttempt()`

## 11. `instruction-queue`

Responsabilidade:
- fila de acoes estruturadas

Classes:
- `InstructionQueueModule`
- `InstructionQueueService`
- `InstructionQueueRepository`
- `InstructionWorker`
- `InstructionActionExecutor`
- `StaleActionRecoveryService`

Entidades:
- `Instruction`
- `InstructionAction`
- `InstructionStatus`
- `InstructionActionStatus`

Fonte:
- `data/runtime/instruction-queue.json`

Contrato publico:
- `enqueueInstruction()`
- `retryInstruction()`
- `tickWorker()`
- `listInstructions()`

## 12. `weekly-planner`

Responsabilidade:
- gerar batches por semana

Classes:
- `WeeklyPlannerModule`
- `WeeklyPlanService`
- `WeeklyPromptPlanner`
- `WeeklyPlanApplier`

Contrato publico:
- `planFromText()`
- `previewWeekPlan()`
- `enqueueWeekPlan()`

## 13. `command-policy`

Responsabilidade:
- autorizacao e escopo

Classes:
- `CommandPolicyModule`
- `CommandPolicyService`
- `SenderAuthorizationPolicy`
- `GroupAuthorizationPolicy`
- `OwnerPolicy`
- `CalendarAccessAuthorizer`

Contrato publico:
- `canUseAssistant()`
- `canUseScheduling()`
- `canManageCalendar(requiredMode)`
- `getCalendarAccessMode()`
- `canUseOwnerTerminal()`
- `canAutoReplyInGroup()`

## 14. `intent-classifier`

Responsabilidade:
- classificar mensagem

Classes:
- `IntentClassifierModule`
- `IntentClassifierService`
- `RuleBasedIntentClassifier`
- `MessageHeuristics`

Contrato publico:
- `classifyMessage()`

## 15. `assistant-context`

Responsabilidade:
- montar contexto LLM

Classes:
- `AssistantContextModule`
- `AssistantContextBuilder`
- `ConversationHistoryReader`
- `ConversationRelevanceRanker`
- `ActiveReferenceResolver`
- `ScheduleContextProvider`

Contrato publico:
- `buildChatContext()`
- `buildSchedulingContext()`

Implementacao:
- historico por chat
- ranking de relevancia
- no minimo:
  - ultimas 8-10 linhas com peso forte
  - preservacao do referente recente

## 16. `llm-orchestrator`

Responsabilidade:
- expor operacoes LLM do dominio

Classes:
- `LlmOrchestratorModule`
- `LlmChatService`
- `LlmScheduleParserService`
- `LlmWeeklyPlannerService`
- `LlmRunLogger`
- `LlmProviderRegistry`

Contrato publico:
- `chat()`
- `parseSchedules()`
- `planWeeklyPrompts()`
- `listModels()`

## 17. `agent-runtime`

Responsabilidade:
- runtime de agente com ferramentas

Classes:
- `AgentRuntimeModule`
- `AgentRuntime`
- `ToolRegistry`
- `ToolCallPolicy`
- `AgentSessionContext`
- `AgentDecisionService`

Entidades:
- `AgentTool`
- `AgentToolResult`
- `AgentExecutionPlan`

Contrato publico:
- `executeConversationTurn()`
- `executeAssistantTurn()`
- `listTools()`

Implementacao:
- nasce de raiz
- conversa, scheduling e diagnostico passam por aqui

## 18. `conversation`

Responsabilidade:
- fluxo de conversa

Classes:
- `ConversationModule`
- `ConversationService`
- `GroupReplyPolicy`
- `ReplyDeliveryPolicy`
- `ConversationAuditService`

Contrato publico:
- `handleIncomingMessage()`
- `generateReply()`

## 19. `owner-control`

Responsabilidade:
- comandos especiais do `app owner`
- acoes administrativas scoped do `group owner`

Classes:
- `OwnerControlModule`
- `OwnerControlService`
- `OwnerScopeAuthorizer`
- `TerminalCommandExecutor`
- `CommandSanitizer`
- `TerminalReplyFormatter`

Contrato publico:
- `detectOwnerCommand()`
- `executeOwnerCommand()`
- `resolveOwnerScope()`

## 20. `alerts`

Responsabilidade:
- regras simples de match

Classes:
- `AlertsModule`
- `AlertRuleService`
- `AlertRuleRepository`
- `AlertActionRunner`

## 21. `automations`

Responsabilidade:
- automacoes declarativas

Classes:
- `AutomationsModule`
- `AutomationService`
- `AutomationRepository`
- `AutomationScheduler`
- `AutomationFireRegistry`

Implementacao:
- idealmente usar o mesmo motor de jobs do scheduler

## 22. `watchdog`

Responsabilidade:
- inbox de problemas

Classes:
- `WatchdogModule`
- `WatchdogService`
- `WatchdogIssueRepository`
- `IssueCollector`
- `IssueNotifier`

Contrato publico:
- `tick()`
- `listIssues()`
- `resolveIssue()`

Regras obrigatorias:
- detetar jobs cujo `sendAt + graceMinutes < now` e ainda nao estejam em `sent`
- olhar para `waiting_confirmation` com grace propria antes de abrir issue
- usar limite configuravel em minutos

## 23. `health-monitor`

Responsabilidade:
- health e readiness

Classes:
- `HealthMonitorModule`
- `HealthCheckService`
- `ModuleHealthAggregator`

## 24. `system-power`

Responsabilidade:
- impedir deep sleep quando o sistema precisa de continuar operacional
- gerir wake locks / sleep inhibitors
- expor politica persistente configuravel

Classes:
- `SystemPowerModule`
- `SystemPowerService`
- `SleepInhibitorAdapter`
- `PowerPolicyRepository`
- `PowerPolicyEvaluator`

Entidades:
- `PowerPolicy`
- `PowerInhibitLease`
- `PowerDemandReason`

Fonte:
- DB `system_settings` ou `power_policy_state`
- estado da ligacao WhatsApp
- estado de jobs/watchdog
- adaptador do sistema operativo

Contrato publico:
- `evaluatePowerPolicy()`
- `acquireInhibitor()`
- `releaseInhibitor()`
- `getPowerStatus()`
- `updatePowerPolicy()`

Regra de implementacao:
- no Linux desktop, preferir integracao standard com `systemd/logind` ou equivalente
- nao implementar isto com loops cegos ou simular atividade do rato/teclado
- a decisao deve ser por politica e com explicacao observavel

## 25. `host-lifecycle`

Responsabilidade:
- instalar e manter persistencia de arranque no PC
- aplicar integracoes host-level do projeto
- servir de companion do host quando o core app corre em `LXD`

Classes:
- `HostLifecycleModule`
- `HostLifecycleService`
- `AutostartInstaller`
- `HostRuntimeStateRepository`
- `HostCompanionCoordinator`

Entidades:
- `AutostartPolicy`
- `HostCompanionStatus`
- `HostIntegrationState`

Fonte:
- DB `system_settings` / `host_runtime_state`
- ficheiros de user service
- estado do sistema operativo

Contrato publico:
- `enableStartWithSystem()`
- `disableStartWithSystem()`
- `getAutostartStatus()`
- `repairHostIntegration()`
- `getHostCompanionStatus()`

Regra de implementacao:
- este modulo pertence ao mesmo projeto, mas idealmente corre no deployable `lume-hub-host`
- o companion de host deve tratar:
  - arranque automatico
  - gestao do ficheiro OAuth live do Codex
  - politicas de energia/sleep
- a GUI deve expor toggles claros para estas politicas

## Estrutura dos ui-modules

Mesmo o frontend deve ser modular e portavel.

### `dashboard`

Classes/componentes:
- `TodayPage`
- `DashboardPage`
- `SystemStatusCard`
- `UpcomingEventsCard`
- `ActiveProblemsCard`
- `QuickActionsCard`
- `RecommendedNextStepCard`
- `EmptyStatePanel`

Nota de UX:
- este modulo deve funcionar como pagina `Hoje`
- e a primeira vista para utilizadores pouco tecnicos
- deve privilegiar clareza operacional, nao densidade tecnica

### `week-planner`

Classes/componentes:
- `WeekPlannerPage`
- `WeekSwitcher`
- `WeekDayColumn`
- `EventCard`
- `NotificationTree`
- `WeekFilterBar`
- `ScheduleWizardEntryPoint`

Nota de UX:
- criar e editar deve poder arrancar de um fluxo guiado
- a tabela tecnica nunca deve ser a unica forma de operar

### `assistant-console`

Classes/componentes:
- `AssistantConsolePage`
- `AssistantChatPanel`
- `AssistantActionPreview`
- `AssistantContextSidebar`
- `SuggestedActionsPanel`
- `AssistantSafetyBanner`

### `delivery-monitor`

Classes/componentes:
- `DeliveryMonitorPage`
- `DeliveryJobTable`
- `DeliveryAttemptTimeline`
- `OutboundSignalPanel`
- `DeliveryStatusSummary`

### `watchdog-inbox`

Classes/componentes:
- `WatchdogInboxPage`
- `WatchdogIssueList`
- `WatchdogIssueDetail`
- `RecoverySuggestionPanel`

### `queue-console`

Classes/componentes:
- `QueueConsolePage`
- `InstructionTable`
- `InstructionDetailDrawer`
- `ActionStateBadge`
- `FanoutPreviewPanel`

### `group-directory-console`

Classes/componentes:
- `GroupDirectoryPage`
- `GroupTable`
- `GroupAliasPanel`
- `GroupOwnerEditor`
- `CalendarAclEditor`

### `whatsapp-console`

Classes/componentes:
- `WhatsAppConsolePage`
- `ConnectionStatusHero`
- `QrOnboardingPanel`
- `ConversationDirectory`
- `PermissionsMatrix`
- `OwnerAccessEditor`

### `settings-center`

Classes/componentes:
- `SettingsPage`
- `WhatsAppSettingsTab`
- `LlmSettingsTab`
- `OAuthRouterSettingsTab`
- `PolicySettingsTab`
- `HostIntegrationSettingsTab`
- `PowerSettingsTab`
- `AdvancedModeToggle`

Regra de UX transversal:
- os ui-modules devem ser pensados para utilizadores com baixo conforto tecnico
- linguagem simples primeiro, detalhe tecnico depois
- empty states, onboarding e recovery flows sao parte do produto, nao detalhe opcional

## Estrutura do backend app

### `apps/lume-hub-backend/src/bootstrap`

Classes:
- `AppBootstrap`
- `RuntimeBuilder`
- `ModuleLoader`
- `ModuleGraphBuilder`
- `KernelFactory`

Implementacao:
- o backend app nao tem logica de negocio
- apenas carrega packages e liga-os

## Estrutura do host companion app

### `apps/lume-hub-host`

Objetivo:
- deployable pequeno para responsabilidades do host

Responsabilidades:
- instalar e manter `systemd --user` ou mecanismo equivalente
- aplicar politica de deep sleep / wake lock
- gerir o mesmo ficheiro OAuth live usado pelo Codex
- expor estado local ao core app

Regra de arquitetura:
- se o core app estiver dentro de `LXD`, o `lume-hub-host` deve correr no host
- o container nao deve ser obrigado a ter controlo total sobre o desktop do host

### `apps/lume-hub-backend/src/main.ts`

Responsabilidade:
- ponto de entrada minimo

Implementacao:
- carrega `AppBootstrap`
- chama `start()`
- instala handlers de shutdown

## Estrutura do frontend app

### `apps/lume-hub-web`

Tecnologia recomendada:
- React
- Vite
- TanStack Query
- React Router
- design system local simples

Classes/objetos principais:
- `WebAppBootstrap`
- `ApiClientProvider`
- `QueryClientFactory`
- `AppRouter`
- `AppShell`

Regra:
- a logica de negocio fica nos modules e api client
- a app so compoe ecras

## Contrato publico por package

Cada package deve ter:

1. `src/public/index.ts`
2. `README.md`
3. `package.json` com `exports`

Exemplo:

```json
{
  "name": "@lume-hub/group-directory",
  "type": "module",
  "main": "./dist/public/index.js",
  "types": "./dist/public/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/public/index.d.ts",
      "default": "./dist/public/index.js"
    }
  }
}
```

## Regras para desenvolvimento em paralelo

Cada package deve poder ser desenvolvido sem editar outros ao mesmo tempo, excepto contratos publicos.

### Lane A: foundation

Pode ser desenvolvido em paralelo:
- `kernel`
- `config`
- `logging`
- `events`
- `clock`
- `contracts`

### Lane B: adapters

Pode ser desenvolvido em paralelo depois de `foundation`:
- `persistence-group-files`
- `http-fastify`
- `ws-fastify`
- `whatsapp-baileys`
- `llm-codex-oauth`
- `llm-openai-compat`

### Lane C: dominio scheduling

Pode ser desenvolvido em paralelo:
- `schedule-weeks`
- `schedule-events`
- `notification-rules`
- `notification-jobs`
- `delivery-tracker`

### Lane D: agent e conversa

Pode ser desenvolvido em paralelo depois de `foundation` e contratos:
- `command-policy`
- `intent-classifier`
- `assistant-context`
- `llm-orchestrator`
- `agent-runtime`
- `conversation`
- `owner-control`

### Lane E: operacao

Pode ser desenvolvido em paralelo:
- `instruction-queue`
- `watchdog`
- `alerts`
- `automations`
- `health-monitor`

### Lane F: frontend

Pode ser desenvolvido em paralelo assim que a API esteja contratualizada:
- `dashboard`
- `week-planner`
- `assistant-console`
- `delivery-monitor`
- `watchdog-inbox`
- `queue-console`
- `group-directory-console`
- `settings-center`

## Como manter os modulos portaveis

1. Nao deixar modulos importar `server.ts` ou `main.ts`.
2. Nao deixar modulos depender de ficheiros globais.
3. Nao deixar modulos ler `process.env` diretamente.
4. Nao deixar modulos falar diretamente com UI.
5. Nao deixar modulos depender do path fisico do repositório.
6. Usar apenas contratos publicos.
7. Toda dependencia concreta entra via constructor injection.

## Estilo de implementacao POO recomendado

### Entidades

Entidades devem:
- proteger invariantes
- nao ser DTOs passivos

Exemplo:
- `ScheduleEvent`
- `NotificationJob`
- `Instruction`

### Value Objects

Criar VOs para:
- `WeekId`
- `Jid`
- `MessageId`
- `DateTimeRange`
- `TimezoneName`
- `PersonIdentifier`

### Application Services

Classes orientadas a casos de uso:
- `CreateScheduleEventService`
- `SendNotificationJobService`
- `EnqueueInstructionService`
- `SwitchCodexAccountService`

### Repositories

Sempre interfaces no dominio e implementacoes no adapter.

### Factories

Factories para:
- instanciar modulos
- construir entidades complexas
- mapear config

### Policies

Policies explicitas para:
- envio
- autorizacao
- escolha de conta OAuth
- resolucao de ambiguidades

## O que reaproveitar do ecossistema e nao reimplementar

### Reaproveitar

1. `Baileys`
   - para WhatsApp
2. `Fastify`
   - para API HTTP
3. `@fastify/websocket`
   - para WS
4. `Pino`
   - para logging
5. `Zod`
   - para schemas e config
6. `better-sqlite3`
   - opcional, apenas para indice local/analytics futuros
7. `Kysely`
   - opcional, apenas se existir indice local auxiliar
8. `Vitest`
   - para testes unitarios/integracao
9. `Playwright`
   - para testes e2e da UI
10. `Vite`
   - para frontend
11. `TanStack Query`
   - para server state no frontend

### Nao reaproveitar cegamente

Nao usar frameworks que tomem conta do dominio inteiro e compliquem a modularidade:
- evitar ORM muito intrusivo
- evitar framework de backend que esconda demasiado o lifecycle dos modulos
- evitar state management frontend excessivamente pesado

## Estrutura de teste por modulo

Cada modulo deve ter:

```text
tests/
  unit/
  integration/
  contract/
```

### Testes unitarios
- entidades
- policies
- value objects
- services puros

### Testes de integracao
- repositorio com ficheiros por grupo e por mes
- adapters concretos
- scheduler
- queue worker

### Testes de contrato
- contrato entre modulo e consumidor
- importante para trabalho paralelo

## Ordem recomendada de implementacao

1. `foundation/*`
2. `adapters/persistence-group-files`
3. `modules/schedule-weeks`
4. `modules/schedule-events`
5. `modules/notification-rules`
6. `modules/notification-jobs`
7. `modules/delivery-tracker`
8. `adapters/whatsapp-baileys`
9. `modules/group-directory`
10. `modules/discipline-catalog`
11. `modules/people-memory`
12. `modules/audience-routing`
13. `modules/command-policy`
14. `modules/instruction-queue`
15. `modules/owner-control`
16. `modules/intent-classifier`
17. `modules/assistant-context`
18. `adapters/llm-codex-oauth`
19. `adapters/llm-openai-compat`
20. `modules/codex-auth-router`
21. `modules/llm-orchestrator`
22. `modules/agent-runtime`
23. `modules/conversation`
24. `modules/watchdog`
25. `modules/alerts`
26. `modules/automations`
27. `adapters/http-fastify`
28. `adapters/ws-fastify`
29. `apps/lume-hub-backend`
30. `packages/ui-modules/*`
31. `apps/lume-hub-web`

## Resultado final esperado

No fim, quero um sistema em que:

1. cada modulo vive na sua package
2. cada modulo tem classe principal, factory e API publica
3. o bootstrap so monta modulos
4. o dominio de schedules e separado da infraestrutura
5. o runtime de agente ja existe desde a primeira versao
6. o OAuth router ja existe desde a primeira versao
7. a semana ISO e parte formal do dominio
8. o frontend reflete o modelo real do sistema e nao uma colagem de painéis
