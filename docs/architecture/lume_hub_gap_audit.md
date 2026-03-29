# Lume Hub Gap Audit

Data: `2026-03-29`

Objetivo:
- descrever apenas gaps reais ainda ativos para o produto scoped atual
- evitar backlog preso a estado antigo, scaffolds removidos ou rondas de implementacao ja fechadas

## Resumo executivo

Conclusao curta:
- as `Wave 0` a `Wave 28` ficaram executadas e validadas
- o canal WhatsApp live ficou fechado com QR, descoberta e envio observavel
- o pipeline conversacional live e os providers LLM reais ficaram integrados
- a API operacional principal e o `weekly-planner` real ficaram fechados
- hardening, cutover, observabilidade minima e limpeza final da ronda ficaram concluidos
- o modo `Live` ja usa backend HTTP real, WebSocket real e launcher local sem servidor provisório
- a partir de `2026-03-28` abriu uma nova ronda de feature para inteligencia LLM por grupo
- a `Wave 25` ja fechou o storage canonico com `llm/instructions.md` e `knowledge/`
- a `Wave 26` ja fechou a knowledge base por grupo com retrieval isolado no `assistant-context`
- a `Wave 27` ja fechou a API e a UI para gerir instrucoes, documentos e preview de contexto por grupo
- a `Wave 28` ja fechou o uso live auditavel dessa memoria no assistente e no scheduling
- a `Wave 30` ja fechou o storage canonico de media recebida em `data/runtime/media/`
- a `Wave 31` ja fechou o ingest live de media inbound, a API da biblioteca e a pagina operacional `/media`
- a `Wave 32` ja fechou a distribuicao multi-grupo de media com queue, dedupe e retry por alvo
- a `Wave 33` ja fechou o fluxo guiado de UI para escolher video, grupos, `dry_run` e envio real com leitura por grupo
- a `Wave 34` ja fechou a limpeza final da ronda, com docs e validadores alinhados ao fluxo final
- a `Wave 39` abriu a pagina `/workspace` com backend live para pesquisar ficheiros, ler previews e correr um agente LLM com alteracoes reais dentro do repo do `LumeHub`
- a `Wave 40` a `Wave 42` fecharam essa ronda com:
  - diff por ficheiro
  - contexto guiado antes de `apply`
  - aprovacao explicita
  - bloqueio de concorrencia
  - auditoria visivel
  - limpeza final de docs e validadores
- no entanto, em `2026-03-29`, ainda nao e recomendavel fazer cutover total do `WA-notify` para o `LumeHub`
- a recomendacao atual continua a ser:
  - `shadow mode`
  - ou migracao parcial por areas
  ate a ronda de paridade de migracao ficar fechada

Em particular, ja nao faz sentido falar de:

- frontend textual
- `Wave 13` a `Wave 17` como futuro
- `ready_to_port/` como dependencia viva
- backlog ativo preso a waves ja fechadas
- `alerts` e `automations` como packages do workspace final

Tambem ja nao faz sentido assumir, sem validar, que:

- `Live` esta em paridade total com o `WA-notify`
- a LLM live esta sempre ativa com provider real por defeito
- o assistente ja aplica alteracoes de calendario reais por queue
- os dados reais de schedules do `WA-notify` ja estao migrados
- a suite automatica ja esta verde o suficiente para cutover

## O que ja esta solido

As seguintes areas existem com base razoavel:

- scheduler por semanas, eventos, regras e jobs
- delivery tracker, dispatcher, watchdog e health monitor
- ownership, ACL e fan-out multi-grupo
- host companion, auth router e packaging operacional
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
- malha minima de regressao com:
  - unit
  - integration
  - e2e
  - `validate:wave24`

## Gaps ativos da ronda nova

Nao restam gaps funcionais ativos na ronda de simplificacao do GUI.
A shell global, as paginas principais, a configuracao avancada sob demanda e a limpeza final da serie ficaram fechadas.

O storage canonico da serie de inteligencia por grupo continua fechado em:

- `data/groups/<jid>/llm/instructions.md`
- `data/groups/<jid>/knowledge/`
- `data/groups/<jid>/knowledge/index.json`

## Gaps ativos da ronda de media

Nao restam gaps funcionais ativos nesta ronda.
O storage, o runtime, a UX guiada e a limpeza final da serie ficaram fechados.

## Gaps ativos da paridade e cutover WA-notify

Esta e, neste momento, a ronda critica para substituicao real do sistema antigo.

### 1. LLM live ainda nao esta no estado certo por defeito

Evidencia confirmada em `2026-03-29`:

- em [system-settings.json](/home/eliaspc/Documentos/lume-hub/runtime/lxd/host-mounts/data/runtime/system-settings.json), a configuracao live estava com:
  - `"llm.enabled": false`
  - provider configurado mas nao assumido como ativo por defeito
- em [llm-run-log.json](/home/eliaspc/Documentos/lume-hub/runtime/lxd/host-mounts/data/runtime/llm-run-log.json), os runs live recentes estavam a usar:
  - `providerId: "local-deterministic"`
  - `modelId: "lume-context-v1"`

Implicacao:

- o `LumeHub` ainda nao esta a correr, por defeito, com o mesmo tipo de capacidade LLM real que o `WA-notify` usa em producao

Fecho planeado:

- `Wave 43`

### 2. O assistente ainda nao fecha o ciclo de scheduling live com apply real

Estado encontrado:

- o `agent-runtime` continua orientado a parsing/preview de scheduling em vez de aplicar alteracoes reais via queue no calendario
- a queue operacional existente continua mais forte em fan-out/distribution do que em `schedule_apply`

Implicacao:

- o caminho "pedir ao assistente para criar/editar uma aula e isso ficar mesmo aplicado" ainda nao esta com paridade operacional suficiente

Fecho planeado:

- `Wave 44`

### 3. Os schedules reais do WA-notify ainda nao estao dentro do LumeHub

Evidencia confirmada em `2026-03-29`:

- `GET /api/schedules?weekId=2026-W14` no `LumeHub` devolveu `events: []`
- o `WA-notify` continua a ter semanas reais em ficheiros como:
  - [w14y2026.json](/home/eliaspc/Containers/wa-notify/data/schedules/w14y2026.json)

Implicacao:

- mesmo que o runtime do `LumeHub` esteja saudavel, ele ainda nao tem a carga operacional real que o `WA-notify` usa hoje

Fecho planeado:

- `Wave 45`

### 4. Alerts e automations continuam por fechar

Evidencia confirmada em `2026-03-29`:

- o `WA-notify` ainda usa:
  - [alerts.json](/home/eliaspc/Containers/wa-notify/data/alerts.json)
  - [automations.json](/home/eliaspc/Containers/wa-notify/data/automations.json)
- no `LumeHub`, esta area continua fora do scope implementado atual

Implicacao:

- ainda existe dependencia funcional do sistema antigo para comportamento que continua vivo em producao

Fecho planeado:

- `Wave 46`

### 5. A validacao automatica ainda nao esta verde para cutover

Evidencia confirmada em `2026-03-29`:

- `pnpm run typecheck` passou
- `pnpm run test` nao passou por completo
- houve pelo menos dois bloqueios reais:
  - falha de integracao por resolucao do package `@lume-hub/workspace-agent`
  - falha no teste [wave11-hardening.test.mjs](/home/eliaspc/Documentos/lume-hub/source/tests/integration/wave11-hardening.test.mjs) no caso `restart keeps fan-out dedupe and retry only reprocesses failed targets`

Implicacao:

- ainda nao existe gate automatica suficientemente forte para declarar o produto pronto para substituicao total sem reservas

Fecho planeado:

- `Wave 47`

### 6. Ainda falta ensaio com dados reais antes do cutover

Estado encontrado:

- ha sinais positivos no runtime live:
  - backend `healthy`
  - WhatsApp ligado
  - grupos descobertos
- mas isso ainda nao equivale a uma semana real operada em paralelo com o `WA-notify`

Implicacao:

- sem shadow mode e checklist de migracao real, o risco de regressao funcional continua demasiado alto

Fecho planeado:

- `Wave 48`

## Gaps ativos da ronda do agente de projeto

Nao restam gaps funcionais ativos nesta ronda.
A fundacao do agente, os diffs, os guardrails operacionais e a limpeza final da serie ficaram fechados.

## Trabalho futuro fora do scope atual

### 1. `alerts` e `automations`

Estado atual:
- os antigos packages `source/packages/modules/alerts` e `source/packages/modules/automations` eram stubs vazios
- foram removidos na `Wave 17` para nao fingirem funcionalidade inexistente
- ficou apenas `legacy_healthy_code/reference_engines/` como referencia residual de comportamento

Regra daqui para a frente:
- so reintroduzir estas areas quando houver desenho, contratos e validacao reais

## Nota final

Se a pergunta for "as waves planeadas ficaram fechadas?", a resposta e:
- sim
- para a ronda anterior, sim
- e a ronda de inteligencia por grupo tambem ficou fechada

Se a pergunta for "o produto ja esta 100% implementado em runtime real?", a resposta e:
- para o runtime operacional base, a base existe e esta bastante forte
- para memoria e instrucoes LLM por grupo, sim
- para media recebida, biblioteca e distribuicao multi-grupo, sim
- para o agente do projeto, ja existe fundacao funcional
- para migracao total do `WA-notify`, ainda nao
- em `2026-03-29`, a recomendacao correta continua a ser:
  - fechar `Wave 43` a `Wave 49`
  - depois fazer shadow mode
  - e so depois decidir cutover
