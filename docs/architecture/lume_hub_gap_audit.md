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
- em `2026-04-20`, uma auditoria `headless` comercial abriu uma nova ronda de produto para:
  - homepage comercial e estados de carga mais humanos
  - simplificacao por pagina para utilizador pouco tecnico
  - separacao entre produto base, consola de operador e detalhe tecnico
  - kit de entrega comercial para `backend containerizado + host companion`

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

Nao restam gaps funcionais ativos nesta ronda.
A `Wave 61` ja fechou a base de composicao e densidade desta ronda.
A `Wave 62` ja fechou a simplificacao estrutural da pagina `LLM`.
A `Wave 63` ja fechou a linguagem canonica, a divulgacao progressiva e a leitura do `codex auto router` como lista de `3+` tokens.
A `Wave 64` ja fechou a migracao da shell restante para os novos objetos.
A `Wave 65` ja fechou a limpeza final desta ronda:

- a pagina `LLM` deixou de manter aliases de transicao quando os objetos genericos ja estavam canonicos
- a serie ficou consolidada em `validate:wave65`
- os validadores intermédios `61..64` foram removidos
- docs e README ficaram alinhados ao estado final da shell
- o fecho da ronda inclui relancamento do `LumeHub` live e verificacao de saude

O objetivo correto desta ronda nao e inventar novas features.
E simplificar o que ja existe, torna-lo coerente e fazer com que o utilizador perceba rapidamente:

- onde perguntar
- onde preparar uma alteracao real
- o que esta bloqueado
- e qual e o proximo passo util

## Gaps ativos da ronda `commercial-readiness`

Nao restam gaps ativos na ronda `commercial-readiness`.
A `Wave 72` fechou a limpeza final e consolidou a serie em `validate:wave72`.
A `Wave 73` acrescentou o cutover operacional de avisos WA-Notify -> LumeHub e o ownership OAuth por `LUME_HUB_CODEX_AUTH_SOURCES`.

Estado canonico deixado:

- `Hoje` e a homepage comercial real
- loading, erro e vazio explicam o que aconteceu e qual o proximo passo
- `Calendario` e summary-first; `LLM` e chat-first
- `Grupos` e `WhatsApp` estao organizados como fluxos guiados
- `LumeHub`, `Codex Router` e `Migracao` estao separados por papel
- apos o cutover total do `WA-Notify`, `Migracao` deixa de existir como pagina/menu navegavel; manutencao legacy fica apenas em APIs tecnicas controladas
- lembretes por grupo suportam `1..N` regras, janelas antes, horarios fixos e janelas depois
- copy de lembretes pode ser assistida pela LLM e auditada como `gerado -> preparado -> enviado`
- `Codex Router` suporta lista de `3+` tokens, mantem backup antes de trocar token e sincroniza o `auth.json` live de volta para a origem da conta ativa antes de a substituir
- o kit comercial declara honestamente `backend containerizado + host companion`, sem vender o produto como `um container unico`
- os validadores intermédios da ronda foram removidos; a entrada canonica atual e `validate:wave73`

## Gaps ativos da ronda `ui-ux-commercial-polish`

Nao restam gaps ativos nesta ronda.
A `Wave 78` fechou a limpeza final, consolidou os validadores e relancou o LumeHub.

Estado canonico deixado:

- a shell ficou mais compacta e menos tecnica nas areas tocadas
- a leitura operacional da pagina ficou menos repetitiva
- o fecho da ronda ficou consolidado em `validate:wave78`

## Gaps ativos da ronda `gui-simplification-pass-2`

A ronda esta aberta.
A `Wave 79` fechou o fix de alertas falsos e o radar live em `Hoje`.

Estado canonico deixado:

- `Hoje` passou a abrir com radar live compacto em vez de atalhos paralelos
- alertas parciais deixaram de aparecer como risco confirmado no resumo principal
- a validacao consolidada mais recente e `validate:wave79`

Trabalho ja reservado para a ronda seguinte:

- arrancar a ronda com simplificacao de shell e hierarquia com menos carga simultanea
- fazer uma nova revisao headless das rotas live antes de mexer no layout dessa ronda
- acrescentar um modulo `official-update-sync` para descobrir e descarregar updates a partir do repo oficial, com toggle `on/off`

## Trabalho futuro fora do scope atual

### 1. `alerts` e `automations`

Estado atual:
- os antigos stubs removidos na `Wave 17` foram substituidos por implementacoes reais:
  - [message-alerts](/home/eliaspc/Documentos/Git/lume-hub/source/packages/modules/message-alerts)
  - [automations](/home/eliaspc/Documentos/Git/lume-hub/source/packages/modules/automations)
- a pagina `Configuracao` ja suporta preview/apply dos ficheiros legacy:
  - [alerts.json](/home/eliaspc/Containers/wa-notify/data/alerts.json)
  - [automations.json](/home/eliaspc/Containers/wa-notify/data/automations.json)
- o runtime live ja executa `alerts` por inbound e `automations` por tick, com auditoria exposta em API/UI

Regra daqui para a frente:
- manter esta area apenas com contratos reais, migracao explicita e validadores dedicados

## Nota final

Se a pergunta for "as waves planeadas ficaram fechadas?", a resposta e:
- as rondas anteriores, sim
- a ronda de inteligencia por grupo, sim
- a ronda `ui-clarity`, sim
- a ronda `commercial-readiness`, sim
- a ronda `ui-ux-commercial-polish`, sim
- a ronda `gui-simplification-pass-2` esta aberta, com a `Wave 79` fechada e `Wave 80` como proxima wave planeada

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
