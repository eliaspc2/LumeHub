# Lume Hub Gap Audit

Data: `2026-03-27`

Objetivo:
- descrever apenas os gaps reais que restam depois das `Wave 0` a `Wave 17`
- evitar backlog preso a estado antigo do frontend ou a scaffolds ja removidos

## Resumo executivo

Conclusao curta:
- as `Wave 0` a `Wave 17` ficaram executadas e validadas
- o frontend operacional ja existe e a limpeza final do repositorio foi feita
- nao ha waves pendentes neste momento
- o backlog restante esta concentrado em integracoes reais de runtime e robustez de producao

Em particular, ja nao faz sentido falar de:

- frontend textual
- `Wave 13` a `Wave 17` como futuro
- `ready_to_port/` como dependencia viva
- `alerts` e `automations` como packages do workspace final

Esses pontos foram limpos ou fechados na `Wave 17`.

## O que ja esta solido

As seguintes areas existem com base razoavel:

- scheduler por semanas, eventos, regras e jobs
- delivery tracker, dispatcher, watchdog e health monitor
- ownership, ACL e fan-out multi-grupo
- host companion, auth router e packaging basico
- shell web operacional com:
  - dashboard
  - fluxos guiados
  - pagina WhatsApp
  - permissoes e ownership
  - modo `advanced details`
  - foco em acessibilidade base e confianca operacional

## Gaps reais por prioridade

### 1. O backend publicado ainda nao tem composition root real

Estado atual:
- `apps/lume-hub-backend/src/bootstrap/ModuleLoader.ts` continua a devolver `[]`
- `ModuleGraphBuilder.ts` continua a devolver `[]`
- `KernelFactory.ts` cria `new ApplicationKernel()` sem carregar o produto real

Impacto:
- o bundle existe, mas o backend publicado ainda nao representa um runtime de produto completo

Onde fechar:
- `apps/lume-hub-backend/src/bootstrap/ModuleLoader.ts`
- `apps/lume-hub-backend/src/bootstrap/ModuleGraphBuilder.ts`
- `apps/lume-hub-backend/src/bootstrap/KernelFactory.ts`
- `apps/lume-hub-backend/src/bootstrap/AppBootstrap.ts`

### 2. HTTP e WS reais continuam em falta

Estado atual:
- `http-fastify` continua centrado em `inject()`
- `ws-fastify` continua a ser registry/pub-sub em memoria

Impacto:
- falta listener real de rede, porta configuravel, endpoint WS e serving operacional da app

Onde fechar:
- `source/packages/adapters/http-fastify`
- `source/packages/adapters/ws-fastify`
- `source/apps/lume-hub-backend`

### 3. A integracao WhatsApp live continua por fazer

Estado atual:
- o adapter `whatsapp-baileys` ainda nao faz socket real, QR real nem descoberta live de grupos/conversas

Impacto:
- a UX de WhatsApp ja existe, mas o canal real continua dependente de wiring futuro

Onde fechar:
- `source/packages/adapters/whatsapp-baileys`
- `source/packages/modules/group-directory`
- `source/packages/modules/people-memory`
- `source/packages/modules/conversation`
- `source/packages/adapters/http-fastify`
- `source/packages/adapters/ws-fastify`

### 4. O pipeline inbound -> conversa -> reply -> envio nao esta ligado no runtime

Estado atual:
- `conversation`, `assistant-context` e `agent-runtime` existem
- falta a composicao do backend que liga inbound do WhatsApp ao fluxo conversacional e ao envio de replies

Onde fechar:
- `source/apps/lume-hub-backend`
- `source/packages/modules/conversation`
- `source/packages/modules/assistant-context`
- `source/packages/modules/agent-runtime`
- `source/packages/adapters/whatsapp-baileys`

### 5. Os providers LLM reais ainda sao stubs

Estado atual:
- `llm-codex-oauth` e `llm-openai-compat` ainda expõem apenas `describe()`

Impacto:
- o runtime conversacional continua sem provider real de producao

Onde fechar:
- `source/packages/adapters/llm-codex-oauth`
- `source/packages/adapters/llm-openai-compat`
- `source/packages/modules/llm-orchestrator`
- `source/packages/modules/codex-auth-router`

### 6. A API do produto continua parcial

Estado atual:
- existem endpoints para dashboard, groups, people, routing, watchdog, settings e workspace WhatsApp
- continuam em falta varias rotas canonicamente esperadas, como:
  - `GET /api/status`
  - `GET /api/qr`
  - `GET /api/qr.svg`
  - `GET /api/schedules`
  - `GET /api/instruction-queue`
  - `GET /api/llm/models`
  - `POST /api/llm/chat`
  - `POST /api/send`

Onde fechar:
- `source/packages/adapters/http-fastify`
- modulos de scheduling, instruction queue, conversation e llm

### 7. `weekly-planner` do dominio ainda esta minimo

Estado atual:
- `source/packages/modules/weekly-planner` continua a ser um modulo estrutural sem comportamento real

Impacto:
- a UX de planeamento existe, mas o backend de planeamento semanal ainda nao esta verdadeiramente implementado

Onde fechar:
- `source/packages/modules/weekly-planner`
- depois ligar a `source/packages/ui-modules/week-planner`

### 8. A cobertura de testes continua curta para o produto final

Estado atual:
- continuam a existir poucos testes centrais:
  - `source/tests/unit/notification-job-cleanup-policy.test.mjs`
  - `source/tests/integration/wave11-hardening.test.mjs`
  - `source/tests/e2e/dashboard-operations.test.mjs`

Impacto:
- as validacoes por wave sao uteis, mas a malha de regressao ainda e pequena para producao

Onde fechar:
- `source/tests/*`
- e idealmente suites locais em packages criticos

### 9. `alerts` e `automations` sairam do workspace ativo

Estado atual:
- os antigos packages `source/packages/modules/alerts` e `source/packages/modules/automations` eram stubs vazios
- foram removidos na `Wave 17` para nao fingirem funcionalidade inexistente
- ficou apenas `legacy_healthy_code/reference_engines/` como referencia residual de comportamento

Regra daqui para a frente:
- so reintroduzir estas areas quando houver desenho, contratos e validacao reais

## Ordem recomendada para o backlog restante

1. composition root real do backend
2. HTTP real + WS real
3. WhatsApp live + QR + descoberta + pipeline inbound/outbound
4. providers LLM reais
5. API restante por casos de uso
6. `weekly-planner` do dominio
7. reforco forte de testes

## Nota final

Se a pergunta for "as waves planeadas ficaram fechadas?", a resposta e:
- sim

Se a pergunta for "o produto ja esta 100% implementado em runtime real?", a resposta e:
- nao
- o que falta ja nao e scaffold nem limpeza
- falta sobretudo wiring real de rede, WhatsApp, LLM e reforco de testes
