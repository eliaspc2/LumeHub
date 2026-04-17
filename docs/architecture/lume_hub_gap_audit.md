# Lume Hub Gap Audit

Data: `2026-04-17`

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
- a `Wave 43` ja fechou a LLM live por defeito:
  - `system-settings.json` live com `llm.enabled = true`
  - `codex-oauth` ativo por defeito quando a auth existe
  - fallback deterministico visivel e auditavel quando a auth nao esta pronta
- a `Wave 45` ja fechou o importador de schedules do `WA-notify`:
  - leitura live de `wNNyYYYY.json`
  - preview operacional na pagina `Configuracao`
  - apply idempotente para o storage mensal canonico por grupo
  - relatorio claro de criados, atualizados, ambiguos e grupos em falta
- a `Wave 47` ja fechou a suite verde e o hardening de restart/cutover:
  - `pnpm run test` passou por completo
  - o caso `restart keeps fan-out dedupe and retry only reprocesses failed targets` ficou verde
  - o e2e live de cutover ficou alinhado com o copy canónico atual
- no entanto, em `2026-03-30`, a decisao de cutover total do `WA-notify` para o `LumeHub` continua dependente de shadow mode real com dados de producao
- a ronda de paridade de migracao ficou fechada do ponto de vista de implementacao
- a `Wave 50` ja deixou pronta uma pagina `Migracao` para:
  - readiness live
  - checklist de shadow mode
  - comparacao curta `WA-notify` vs `LumeHub`
  - GUI do `codex auto router`
- em `2026-04-17`, abriu uma nova ronda de UX/UI para:
  - reforcar contratos internos de composicao
  - simplificar a pagina `LLM`
  - cortar copy tecnica e espaco morto na shell operacional

Em particular, ja nao faz sentido falar de:

- frontend textual
- `Wave 13` a `Wave 17` como futuro
- `ready_to_port/` como dependencia viva
- backlog ativo preso a waves ja fechadas
- `alerts` e `automations` como packages do workspace final

Tambem ja nao faz sentido assumir, sem validar, que:

- `Live` esta em paridade total com o `WA-notify`
- o shadow mode ja foi provado com dados reais durante uma semana inteira

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

Nao restam gaps tecnicos ativos na ronda de paridade e cutover WA-notify.
O que sobra agora e um passo operacional fora do backlog de implementacao:

- executar a semana paralela real
- comparar `WA-notify` e `LumeHub` com dados de producao
- decidir depois o cutover total

## Gaps ativos da ronda curta de operacao de migracao

Nao restam gaps funcionais ativos nesta ronda curta.
A `Wave 50` deixou a pagina `Migracao` e o GUI live do `codex auto router` operacionais.
A `Wave 51` ja fechou a limpeza final desta ronda curta:

- validador consolidado em `validate:wave51`
- docs, README e backlog alinhados ao estado final
- limpeza de copy e validadores obsoletos da `Wave 50`

## Gaps ativos da ronda do agente de projeto

Nao restam gaps funcionais ativos nesta ronda.
A fundacao do agente, os diffs, os guardrails operacionais e a limpeza final da serie ficaram fechados.

## Gaps ativos da ronda `group-first`

Nao restam gaps funcionais ativos nesta ronda.
A `Wave 60` ja fechou a limpeza final da ronda `group-first`:

- `validate:wave60` consolidou typecheck, build, testes de regressao de ownership/roteamento e smoke live das rotas principais
- os validadores intermédios da serie `52..59` foram removidos
- a pagina `LLM` ficou sem aliases provisórias antigas
- docs, README e backlog passaram a declarar que nao ha waves ativas

O estado canonico desta ronda fica:

- calendario semanal como vista operacional principal
- paginas por grupo como unidade de configuracao e trabalho
- modos `com_agendamento` e `distribuicao_apenas` fechados ponta a ponta
- ownership por grupo e politica de tag ao bot com enforcement real
- `WhatsApp`, `LumeHub`, `Migracao` e `LLM` como areas separadas

## Gaps ativos da ronda `ui-clarity`

Existem gaps reais e visiveis nesta ronda nova.
A `Wave 61` ja fechou a base de composicao e densidade desta ronda.
Os gaps ativos concentram-se agora sobretudo na propria pagina `LLM` e na migracao do resto da shell.

Os screenshots da pagina `LLM` e o estado atual do frontend mostram tres problemas de base:

1. Sobrecarga cognitiva na pagina `LLM`

- a rota `/assistant` mistura chat direto, escopo, preview/apply, auditoria e runs recentes quase ao mesmo nivel de destaque
- ha copy redundante entre `hero`, cards explicativos, hints e summaries
- a separacao entre "perguntar" e "agir" existe funcionalmente, mas ainda nao esta clara o suficiente na hierarquia visual

2. Espaco morto residual e densidade irregular

- a `Wave 61` fechou a base, mas a pagina `LLM` ainda precisa de aproveitar melhor essa fundacao
- continuam a existir cards, estados vazios e listas curtas demasiado abertas para a quantidade real de conteudo
- em varias areas o layout ainda gasta largura e altura em blocos equivalentes quando devia compactar ou assimetrizar

3. Linguagem pouco humana e demasiado tecnica

- a UI ainda usa termos internos ou operacionais demais para o alvo principal
- varias etiquetas explicam o mecanismo em vez de priorizar a acao e o resultado esperado
- faltam padroes canonicos curtos para estados como ligado, bloqueado, sem preview, pronto e a rever

O objetivo correto desta ronda nao e inventar novas features.
E simplificar o que ja existe, torna-lo coerente e fazer com que o utilizador perceba rapidamente:

- onde perguntar
- onde preparar uma alteracao real
- o que esta bloqueado
- e qual e o proximo passo util

## Trabalho futuro fora do scope atual

### 1. `alerts` e `automations`

Estado atual:
- os antigos stubs removidos na `Wave 17` foram substituidos por implementacoes reais:
  - [message-alerts](/home/eliaspc/Documentos/lume-hub/source/packages/modules/message-alerts)
  - [automations](/home/eliaspc/Documentos/lume-hub/source/packages/modules/automations)
- a pagina `Configuracao` ja suporta preview/apply dos ficheiros legacy:
  - [alerts.json](/home/eliaspc/Containers/wa-notify/data/alerts.json)
  - [automations.json](/home/eliaspc/Containers/wa-notify/data/automations.json)
- o runtime live ja executa `alerts` por inbound e `automations` por tick, com auditoria exposta em API/UI

Regra daqui para a frente:
- manter esta area apenas com contratos reais, migracao explicita e validadores dedicados

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
- para migracao de schedules reais do `WA-notify`, sim
- para `alerts` e `automations`, sim
- para suite automatica e hardening de restart/cutover, sim
- para migracao total do `WA-notify`, do ponto de vista de implementacao a base ficou pronta
- para a operacao de shadow mode e do `codex auto router` no GUI, a base tambem ja ficou pronta
- em `2026-03-30`, a recomendacao correta continua a ser:
  - usar o readiness live e os checklists operacionais ja fechados
  - fazer shadow mode real
  - e so depois decidir cutover
