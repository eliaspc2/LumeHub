# Lume Hub Gap Audit

Data: `2026-03-27`

Objetivo:
- comparar a descricao canonica do projeto com o estado real do codigo em `source/`
- separar o que ja existe do que ainda esta apenas minimo, parcial ou em falta
- deixar backlog pratico com:
  - o que falta
  - como deve ser implementado
  - em que modulo deve viver

## Leitura-base usada

- `README.md`
- `docs/architecture/lume_hub_rewrite_master_prompt.md`
- `docs/architecture/lume_hub_modular_implementation_spec.md`
- `docs/architecture/lume_hub_implementation_waves.md`
- `docs/architecture/lume_hub_llm_kickoff_prompt.md`
- `docs/reuse/lume_hub_healthy_code_manifest.md`
- `docs/deployment/lume_hub_lxd_runtime_plan.md`
- `runtime/lxd/README.md`

## Resumo executivo

Conclusao curta:
- as waves ficaram fechadas no sentido formal e ha muito dominio ja portado
- mas a descricao completa do produto ainda nao esta implementada a 100%
- o maior gap atual nao esta no dominio-base
- esta sobretudo em:
  - composicao real do backend
  - adapters reais de rede/WhatsApp/LLM
  - UI web real em browser
  - modulos ainda em stub
  - cobertura de testes muito abaixo do que a spec pede

## O que ja esta implementado com base razoavel

Estas areas ja existem e parecem suficientemente reais para servir de fundacao:

- `packages/modules/schedule-weeks`
- `packages/modules/schedule-events`
- `packages/modules/notification-rules`
- `packages/modules/notification-jobs`
- `packages/modules/delivery-tracker`
- `packages/modules/instruction-queue`
- `packages/modules/watchdog`
- `packages/modules/health-monitor`
- `packages/modules/group-directory`
- `packages/modules/discipline-catalog`
- `packages/modules/people-memory`
- `packages/modules/audience-routing`
- `packages/modules/command-policy`
- `packages/modules/assistant-context`
- `packages/modules/agent-runtime`
- `packages/modules/conversation`
- `packages/modules/codex-auth-router`
- `packages/modules/host-lifecycle`
- `packages/modules/system-power`
- `scripts/validate-wave1.mjs` ate `scripts/validate-wave12.mjs`

Isto significa:
- o nucleo de scheduling
- o fan-out
- ownership e ACL
- watchdog
- host companion
- auth router
- contexto conversacional

ja estao representados no codigo.

## Gaps reais por prioridade

### 1. Composicao real do backend ainda nao existe

Estado atual:
- `apps/lume-hub-backend/src/bootstrap/ModuleLoader.ts` devolve `[]`
- `apps/lume-hub-backend/src/bootstrap/ModuleGraphBuilder.ts` devolve `[]`
- `apps/lume-hub-backend/src/bootstrap/KernelFactory.ts` cria `new ApplicationKernel()` sem carregar packages
- `apps/lume-hub-backend/src/main.ts` inclui comentario explicito: `Keep the backend process alive until a real network/runtime listener is attached.`

O que falta:
- um composition root real do produto
- carregamento dos modulos de dominio
- ligacao dos adapters aos modulos
- bootstrap operacional do backend

Como implementar:
- transformar `ModuleLoader` em compositor real de modules e adapters
- usar `ModuleGraphBuilder` para declarar ordem/dependencias
- registar no `ApplicationKernel`:
  - adapters
  - modules
  - workers/ticks necessarios
- fazer `AppBootstrap.start()` subir backend funcional e nao apenas um processo vivo

Onde implementar:
- `apps/lume-hub-backend/src/bootstrap/ModuleLoader.ts`
- `apps/lume-hub-backend/src/bootstrap/ModuleGraphBuilder.ts`
- `apps/lume-hub-backend/src/bootstrap/KernelFactory.ts`
- `apps/lume-hub-backend/src/bootstrap/AppBootstrap.ts`

### 2. HTTP real ainda nao esta ligado a um servidor de rede

Estado atual:
- `packages/adapters/http-fastify/src/public/index.ts` oferece um servidor injectavel em memoria
- nao existe `listen()`
- nao existe binding de porta configuravel
- nao existe serving real da UI

O que falta:
- API HTTP local real na porta configuravel
- integrar as rotas reais do produto no runtime do backend

Como implementar:
- criar wrapper real com `fastify`
- montar `RouteRegistrar` sobre instancia real
- expor `listen(host, port)`
- ler host/porta via `config`
- opcionalmente servir assets da UI

Onde implementar:
- `packages/adapters/http-fastify`
- `apps/lume-hub-backend`
- `packages/foundation/config`

### 3. WebSocket real ainda e apenas pub/sub em memoria

Estado atual:
- `packages/adapters/ws-fastify/src/public/index.ts` e um registry em memoria
- a spec pede `@fastify/websocket`
- nao existem sockets reais, handshake nem endpoint WS

O que falta:
- canal WS real para eventos operacionais

Como implementar:
- substituir ou complementar o registry em memoria por gateway real baseado em `@fastify/websocket`
- expor feed de eventos para:
  - `qr`
  - `status`
  - `message`
  - `alert`
- ligar `UiEventPublisher` ao backend HTTP real

Onde implementar:
- `packages/adapters/ws-fastify`
- `apps/lume-hub-backend`

### 4. A web app ainda nao e uma UI real de browser

Estado atual:
- `apps/lume-hub-web/src/main.ts` apenas faz `console.log(await shell.renderText())`
- `apps/lume-hub-web/src/shell/AppShell.ts` gera texto
- `apps/lume-hub-web/src/app/ApiClientProvider.ts` usa `UnavailableFrontendApiTransport` quando nao ha transporte
- a spec pede `React`, `Vite`, `TanStack Query`, `React Router`

O que falta:
- frontend web real
- navegacao de browser real
- formularios e interacao visual

Como implementar:
- converter `apps/lume-hub-web` para SPA real
- manter `FrontendApiClient` como camada typed
- reimplementar `AppShell` como layout visual
- usar os `ui-modules` como composicao de componentes reais, nao apenas texto

Onde implementar:
- `apps/lume-hub-web`
- `packages/ui-modules/*`
- `packages/adapters/frontend-api-client`

### 5. Varios ui-modules ainda estao em stub

Estado atual:
- `packages/ui-modules/assistant-console/src/index.ts` so define config de rota
- `packages/ui-modules/week-planner/src/index.ts` so define config de rota
- `packages/ui-modules/delivery-monitor/src/index.ts` so define config de rota
- mesmo os modulos ja usados continuam em modo textual minimo

O que falta:
- paginas reais para assistente, planeamento semanal e monitor de entrega

Como implementar:
- seguir a spec de classes/componentes:
  - `AssistantConsolePage`
  - `AssistantChatPanel`
  - `AssistantActionPreview`
  - `AssistantContextSidebar`
  - `WeekPlannerPage`
  - `WeekDayColumn`
  - `DeliveryMonitorPage`
  - `DeliveryAttemptTimeline`
- primeiro criar `render()` real e depois integrar na SPA

Onde implementar:
- `packages/ui-modules/assistant-console`
- `packages/ui-modules/week-planner`
- `packages/ui-modules/delivery-monitor`

### 6. Integracao WhatsApp real ainda nao existe

Estado atual:
- `packages/adapters/whatsapp-baileys/src/public/BaileysWhatsAppGateway.ts` normaliza mensagens e simula `sendText()`
- nao existe socket real Baileys
- nao existe QR login real
- nao existem rotas `GET /api/qr` ou `GET /api/qr.svg`
- nao existe sincronizacao live de grupos e conversas

O que falta:
- sessao real de WhatsApp Web
- QR login
- ligacao de inbound/outbound reais
- descoberta real de grupos/conversas

Como implementar:
- integrar Baileys real:
  - lifecycle do socket
  - reconnect policy
  - session store real
  - QR event stream
  - ingestao de mensagens
  - envio real com reconciliacao por ACK
- publicar metadata de grupos para `group-directory`
- alimentar `people-memory` e historico conversacional

Onde implementar:
- `packages/adapters/whatsapp-baileys`
- `packages/modules/group-directory`
- `packages/modules/people-memory`
- `packages/modules/conversation`
- `packages/adapters/http-fastify`
- `packages/adapters/ws-fastify`

### 7. O fluxo inbound WhatsApp -> conversa -> reply -> envio ainda nao esta ligado

Estado atual:
- `conversation`, `agent-runtime` e `assistant-context` existem
- `schedule-dispatcher` usa `BaileysWhatsAppGateway`
- mas o backend app nao faz a composicao entre inbound do WhatsApp e `ConversationService`

O que falta:
- pipeline runtime do bot em producao

Como implementar:
- no backend composition root:
  - subscrever inbound do gateway
  - resolver identidade/pessoa/grupo
  - chamar `ConversationService.handleIncomingMessage()`
  - se houver reply, usar `gateway.sendText()`
  - auditar resultado e sinais de entrega

Onde implementar:
- `apps/lume-hub-backend`
- `packages/modules/conversation`
- `packages/modules/assistant-context`
- `packages/modules/agent-runtime`
- `packages/adapters/whatsapp-baileys`

### 8. Os providers LLM reais ainda nao estao implementados

Estado atual:
- `packages/adapters/llm-codex-oauth/src/public/index.ts` tem apenas `describe()`
- `packages/adapters/llm-openai-compat/src/public/index.ts` tem apenas `describe()`
- `packages/modules/llm-orchestrator/src/module/LlmOrchestratorModule.ts` usa `DeterministicLlmProvider` por defeito

O que falta:
- chamadas reais ao provider Codex OAuth
- fallback OpenAI compatible real
- catalogo de modelos real

Como implementar:
- em `llm-codex-oauth`:
  - `CodexOAuthClient`
  - `CodexOAuthStreamingParser`
  - `CodexModelsCatalogClient`
  - leitura do auth live escolhido pelo `codex-auth-router`
- em `llm-openai-compat`:
  - client de chat completions/responses compativel
  - client de modelos
- depois registar esses providers no `LlmProviderRegistry`

Onde implementar:
- `packages/adapters/llm-codex-oauth`
- `packages/adapters/llm-openai-compat`
- `packages/modules/llm-orchestrator`
- `packages/modules/codex-auth-router`

### 9. A cobertura da API do produto esta longe da lista canonica

Estado atual:
- as rotas implementadas cobrem dashboard, groups, people, routing rules, watchdog e settings
- a prompt canonica pede muito mais endpoints

Exemplos ainda em falta:
- `GET /api/status`
- `POST /api/admin/restart`
- `GET /api/qr`
- `GET /api/qr.svg`
- `GET /api/automations`
- `GET /api/schedules`
- `GET /api/schedules/diagnostics`
- `PUT /api/schedules/settings`
- `POST /api/schedules`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`
- `POST /api/schedules/:id/enable`
- `POST /api/schedules/:id/disable`
- `GET /api/instruction-queue`
- `POST /api/instruction-queue/tick`
- `POST /api/instruction-queue/:id/retry`
- `GET /api/commands/logs`
- `GET /api/wa/messages`
- `GET /api/llm/models`
- `GET /api/llm/logs`
- `POST /api/llm/chat`
- `POST /api/llm/assistant`
- `POST /api/llm/schedules/parse`
- `POST /api/llm/schedules/apply`
- `POST /api/llm/schedules/fix`
- `POST /api/send`

Como implementar:
- por casos de uso, nao tudo num handler gigante
- cada conjunto de rotas deve delegar para um service/modulo especifico

Onde implementar:
- `packages/adapters/http-fastify`
- `packages/modules/schedule-*`
- `packages/modules/instruction-queue`
- `packages/modules/llm-orchestrator`
- `packages/modules/conversation`
- `packages/modules/automations`

### 10. `weekly-planner` ainda esta em stub

Estado atual:
- `packages/modules/weekly-planner` so expoe `moduleName`
- a spec pede:
  - `WeeklyPlanService`
  - `WeeklyPromptPlanner`
  - `WeeklyPlanApplier`
  - contrato `planFromText()`, `previewWeekPlan()`, `enqueueWeekPlan()`

Como implementar:
- criar entidades de `week plan`
- usar `llm-orchestrator.planWeeklyPrompts()`
- integrar com `schedule-weeks`, `schedule-events` e `instruction-queue`

Onde implementar:
- `packages/modules/weekly-planner`
- depois `packages/ui-modules/week-planner`

### 11. `alerts` ainda esta em stub

Estado atual:
- `packages/modules/alerts` so expoe `moduleName`
- a spec pede:
  - `AlertRuleService`
  - `AlertRuleRepository`
  - `AlertActionRunner`

Como implementar:
- modelar regras declarativas de alerta
- persistir regras
- correr matching sobre eventos relevantes
- disparar acao de alerta para queue ou mensagem direta

Onde implementar:
- `packages/modules/alerts`
- possivelmente integrando com `watchdog`, `notification-jobs` e `instruction-queue`

### 12. `automations` ainda esta em stub

Estado atual:
- `packages/modules/automations` so expoe `moduleName`
- a spec pede:
  - `AutomationService`
  - `AutomationRepository`
  - `AutomationScheduler`
  - `AutomationFireRegistry`

Como implementar:
- definir automacoes declarativas
- persistir estado/ultima execucao
- reusar o motor de jobs do scheduler quando possivel

Onde implementar:
- `packages/modules/automations`
- integrar com `instruction-queue` e `schedule-dispatcher`

### 13. Logs operacionais existem parcialmente, mas faltam API e UI reais para eles

Estado atual:
- existem logs de runs LLM em `packages/modules/llm-orchestrator`
- existe `ConversationAuditRepository`
- mas a API canonicamente pedida para logs e observabilidade ainda nao existe

O que falta:
- leitura de logs de mensagens WA
- leitura de logs de comandos
- leitura de logs LLM pela UI

Como implementar:
- expor repositories/queries especificas
- criar endpoints dedicados
- ligar paginas/tabs na UI

Onde implementar:
- `packages/modules/conversation`
- `packages/modules/llm-orchestrator`
- `packages/modules/owner-control`
- `packages/adapters/http-fastify`
- `packages/ui-modules/settings-center`
- `packages/ui-modules/assistant-console`
- `packages/ui-modules/delivery-monitor`

### 14. Deploy e packaging existem, mas o bundle ainda embala um backend pouco ligado ao produto

Estado atual:
- a `Wave 12` gera artefactos e manifests
- mas o backend publicado continua dependente do gap de composicao e do gap de servidor real

O que falta:
- fazer o deploy empacotar um backend efetivamente funcional em rede

Como implementar:
- fechar primeiro os gaps 1, 2, 3, 6 e 7
- depois rever `package-wave12.mjs` e os manifests para incluir config/entrypoints reais

Onde implementar:
- `apps/lume-hub-backend`
- `packages/adapters/http-fastify`
- `packages/adapters/ws-fastify`
- `packages/adapters/whatsapp-baileys`
- `source/scripts/package-wave12.mjs`

### 15. A cobertura de testes esta muito abaixo dos casos obrigatorios

Estado atual:
- existem apenas:
  - `tests/unit/notification-job-cleanup-policy.test.mjs`
  - `tests/integration/wave11-hardening.test.mjs`
  - `tests/e2e/dashboard-operations.test.mjs`
- a prompt canonica define 12 cenarios obrigatorios so na lista minima
- a maioria dos packages continua com `No tests yet`

Como implementar:
- criar testes por modulo e por fluxo:
  - unitarios
  - integracao
  - contrato
  - e2e
- dar prioridade a:
  - duplicados inbound
  - ACK forte
  - scheduler reentrante
  - follow-up conversacional
  - auth router
  - ACL
  - fan-out e retries

Onde implementar:
- `source/tests/*`
- e, idealmente, `tests/` locais em cada package critico

## Ordem recomendada para atacar os gaps

1. backend composition root real
2. HTTP real + WS real
3. WhatsApp real + QR + pipeline inbound/outbound
4. provider LLM real
5. frontend SPA real
6. `weekly-planner`
7. `alerts`
8. `automations`
9. logs e observabilidade completos
10. reforco forte de testes

## Nota final

Se a pergunta for "o projeto esta fechado contra as waves?", a resposta e:
- formalmente, quase todo o plano de waves foi executado

Se a pergunta for "a descricao completa do produto ja esta 100% no codigo?", a resposta e:
- nao
- ainda faltam as integracoes reais e varios modulos/paineis que neste momento estao minimos ou em stub
