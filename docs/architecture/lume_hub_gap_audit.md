# Lume Hub Gap Audit

Data: `2026-03-27`

Objetivo:
- descrever apenas os gaps reais que restam depois das `Wave 0` a `Wave 20`
- evitar backlog preso a estado antigo do frontend ou a scaffolds ja removidos

## Resumo executivo

Conclusao curta:
- as `Wave 0` a `Wave 20` ficaram executadas e validadas
- a `Wave 20` fechou o canal WhatsApp live com QR, descoberta e envio observavel
- o frontend operacional ja existe e a limpeza final do repositorio foi feita
- o modo `Live` ja usa backend HTTP real, WebSocket real e launcher local sem servidor provisório
- o backlog restante voltou a estar organizado em waves ativas
- o backlog restante esta concentrado em integracoes reais de runtime e robustez de producao

Plano ativo de fecho:

- `Wave 21`
  - pipeline conversacional e providers LLM reais
- `Wave 22`
  - API operacional completa e `weekly-planner` real
- `Wave 23`
  - hardening, cobertura e cutover para uso real
- `Wave 24`
  - limpeza final da ronda de runtime real

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
- runtime WhatsApp live com:
  - QR
  - sessao real
  - descoberta de grupos e conversas
  - sincronizacao para `group-directory` e `people-memory`
  - envio live com observacao e confirmacao forte
- shell web operacional com:
  - dashboard
  - fluxos guiados
  - pagina WhatsApp
  - permissoes e ownership
  - modo `advanced details`
  - foco em acessibilidade base e confianca operacional

## Gaps reais por prioridade

### 1. O pipeline inbound -> conversa -> reply -> envio nao esta ligado no runtime

Estado atual:
- `conversation`, `assistant-context` e `agent-runtime` existem
- falta a composicao do backend que liga inbound do WhatsApp ao fluxo conversacional e ao envio de replies

Onde fechar:
- `source/apps/lume-hub-backend`
- `source/packages/modules/conversation`
- `source/packages/modules/assistant-context`
- `source/packages/modules/agent-runtime`
- `source/packages/adapters/whatsapp-baileys`

### 2. Os providers LLM reais ainda sao stubs

Estado atual:
- `llm-codex-oauth` e `llm-openai-compat` ainda expõem apenas `describe()`

Impacto:
- o runtime conversacional continua sem provider real de producao

Onde fechar:
- `source/packages/adapters/llm-codex-oauth`
- `source/packages/adapters/llm-openai-compat`
- `source/packages/modules/llm-orchestrator`
- `source/packages/modules/codex-auth-router`

### 3. A API do produto continua parcial

Estado atual:
- existem endpoints e runtime reais para dashboard, groups, people, routing, watchdog, settings e workspace WhatsApp
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

### 4. `weekly-planner` do dominio ainda esta minimo

Estado atual:
- `source/packages/modules/weekly-planner` continua a ser um modulo estrutural sem comportamento real

Impacto:
- a UX de planeamento existe, mas o backend de planeamento semanal ainda nao esta verdadeiramente implementado

Onde fechar:
- `source/packages/modules/weekly-planner`
- depois ligar a `source/packages/ui-modules/week-planner`

### 5. A cobertura de testes continua curta para o produto final

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

### 6. `alerts` e `automations` sairam do workspace ativo

Estado atual:
- os antigos packages `source/packages/modules/alerts` e `source/packages/modules/automations` eram stubs vazios
- foram removidos na `Wave 17` para nao fingirem funcionalidade inexistente
- ficou apenas `legacy_healthy_code/reference_engines/` como referencia residual de comportamento

Regra daqui para a frente:
- so reintroduzir estas areas quando houver desenho, contratos e validacao reais

## Ordem recomendada para o backlog restante

1. `Wave 21`
2. `Wave 22`
3. `Wave 23`
4. `Wave 24`

## Nota final

Se a pergunta for "as waves planeadas ficaram fechadas?", a resposta e:
- sim

Se a pergunta for "o produto ja esta 100% implementado em runtime real?", a resposta e:
- nao
- o que falta ja nao e scaffold nem limpeza
- falta sobretudo wiring conversacional/LLM, API operacional completa e reforco de testes
