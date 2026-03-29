# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 41` ja foram executadas e validadas.
O runtime `Live` atual continua funcional e a ronda de inteligencia por grupo ficou fechada com storage canonico, retrieval isolado, UI/API operacional, uso live auditavel e limpeza final.

O storage canonico da ronda de media ja ficou aberto com:

- `data/runtime/media/assets/<assetId>/binary`
- `data/runtime/media/assets/<assetId>/metadata.json`
- `data/runtime/media/library.json`

O inbound live de media tambem ja ficou fechado com:

- deteccao de `video`, `image`, `document` e `audio` no adapter WhatsApp
- ingest automatica para a biblioteca operacional
- API para listar assets e consultar metadata
- pagina `/media` no frontend live
- distribuicao multi-grupo de media por `assetId` na `instruction-queue`
- retry apenas dos alvos falhados
- auditoria por alvo na queue

O fluxo guiado desta ronda tambem ja ficou aberto com:

- escolha direta do video recebido na pagina `Media`
- selecao explicita de grupos com master switch e switches por grupo
- `dry_run` e envio `confirmed` a partir da mesma pagina
- visao recente de entrega por grupo sem sair do fluxo

A ronda nova do agente de projeto ja ficou aberta com:

- pagina `/workspace` no frontend
- modulo `workspace-agent` no backend
- API live para pesquisar ficheiros, ler preview e correr runs do agente
- execucao real via `codex exec` limitada ao repo do `LumeHub`
- historico recente de runs e ficheiros alterados

## Estado do plano

As `Wave 35` a `Wave 41` ja foram executadas e validadas.
A ronda de simplificacao do GUI ficou fechada com shell minima, paginas principais mais curtas, configuracao avancada sob demanda e limpeza final dos validadores e do copy de transicao.
A `Wave 40` tambem ja fechou diffs por ficheiro, resumo estruturado de contexto e revisao guiada de ficheiro na pagina `Projeto`.
A `Wave 41` ja fechou aprovacao explicita para `apply`, bloqueio de concorrencia, auditoria visivel do pedido/modo/resultado e guardrails operacionais no backend e na UI.

Ronda ativa:

### Wave 42 - Limpeza final da ronda do agente de projeto

Objetivo:
- fechar a ronda com docs, validadores e naming coerentes ao estado final

Entregaveis:
- consolidacao dos validadores desta ronda
- remocao de copy provisoria e naming de transicao
- docs alinhadas ao fluxo final da pagina `Projeto`

Criterios de aceitacao:
- nao ficam scripts obsoletos, copy provisoria nem referencias a estados intermédios
- o plano volta a ficar curto e legivel

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave42`

Melhor momento para testar:
- no fim da ronda, como regressao curta

O que testar:
- abertura da pagina `Projeto`
- run em `plan`
- run em `apply`
- leitura do historico depois da limpeza final

## Ronda de paridade e cutover WA-notify

Esta ronda existe para fechar os bloqueadores que ainda impedem migracao total do `WA-notify` para o `LumeHub`.

### Wave 43 - LLM live por defeito e configuracao real de provider

Objetivo:
- deixar de depender do provider deterministico local no runtime live por defeito

Entregaveis:
- `system-settings.json` live com LLM real ativa por defeito no ambiente operativo
- bootstrap e UX que expliquem claramente quando o runtime caiu para fallback deterministico
- pagina de configuracao com estado claro de provider, modelo e readiness de auth
- smoke test de live chat a usar provider real quando a auth existe

Criterios de aceitacao:
- o runtime live nao usa `local-deterministic` por defeito quando a auth real existe
- a queda para fallback passa a ser visivel, intencional e auditavel
- os logs live mostram provider/modelo reais numa conversa de teste

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave43`

Melhor momento para testar:
- logo depois desta wave, porque e o primeiro bloqueador real de cutover

O que testar:
- abrir `Assistente` em `Live`
- confirmar provider e modelo ativos
- enviar uma pergunta real e verificar logs

### Wave 44 - Scheduling live com apply real e auditoria de alteracoes

Objetivo:
- passar de parsing para alteracao real do calendario no fluxo do assistente

Entregaveis:
- tool de `schedule_apply` no `agent-runtime`
- caminho de aprovacao -> queue -> persistencia para criar/editar/apagar schedules reais
- auditoria visivel do que foi pedido, do que foi aplicado e em que grupo
- copy/UX clara entre preview e apply

Criterios de aceitacao:
- uma mensagem de scheduling pode criar ou editar um evento real no calendario do grupo
- o operador consegue ver preview antes de aplicar
- a auditoria mostra diff funcional do calendario afetado

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave44`

Melhor momento para testar:
- imediatamente a seguir, porque aqui se valida a paridade funcional mais critica do assistente

O que testar:
- criar agendamento via assistente
- editar um agendamento existente
- confirmar persistencia real e auditoria

### Wave 45 - Importador e migracao de schedules do WA-notify

Objetivo:
- migrar os dados reais `wNNyYYYY.json` do `WA-notify` para o storage canonico mensal por grupo do `LumeHub`

Entregaveis:
- importador idempotente do formato semanal legacy
- mapeamento de grupos legacy para `group-directory`
- comando e/ou pagina operacional de import
- relatorio de itens importados, ignorados e ambiguos

Criterios de aceitacao:
- uma semana real do `WA-notify` entra no `LumeHub` sem perda dos eventos validos
- o import pode ser corrido mais de uma vez sem duplicar eventos
- fica claro o que precisou de intervencao manual

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave45`

Melhor momento para testar:
- assim que a wave fechar, com dados reais de uma ou duas semanas

O que testar:
- importar `w14y2026.json`
- abrir `Semana` em live
- confirmar eventos esperados e ausencia de duplicados

### Wave 46 - Alerts e automations: paridade, substituicao ou decisao fechada

Objetivo:
- fechar definitivamente o que hoje ainda vive no `WA-notify` fora do `LumeHub`

Entregaveis:
- decisao implementada para `alerts` e `automations`:
  - portar com modelo novo
  - ou substituir com capacidade equivalente dentro da nova arquitetura
- migracao minima de `alerts.json` e `automations.json`
- UI/API operacional para o fluxo escolhido

Criterios de aceitacao:
- deixa de haver dependencia operacional do `WA-notify` para alerts/automations
- o comportamento de produto fica coberto pelo `LumeHub`
- a documentacao deixa claro qual foi a decisao final

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave46`

Melhor momento para testar:
- depois do import de schedules, porque aqui ja se testa uma semana de operacao quase completa

O que testar:
- alertas esperados
- automatismos minimos equivalentes
- regressao de dashboard e watchdog

### Wave 47 - Suite verde e hardening de restart/cutover

Objetivo:
- deixar a validacao automatica em estado realmente confiavel para migracao

Entregaveis:
- `pnpm run test` verde
- resolucao da falha `restart keeps fan-out dedupe and retry only reprocesses failed targets`
- resolucao do problema de integracao com `@lume-hub/workspace-agent` no runner
- cobertura minima extra onde os bugs apareceram

Criterios de aceitacao:
- `pnpm run test` passa por completo
- restart, retry e dedupe ficam provados em teste
- os testes de integracao deixam de falhar por wiring/pacotes do workspace

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run test`
- `corepack pnpm run validate:wave47`

Melhor momento para testar:
- no fecho desta wave, como gate de qualidade antes do shadow mode serio

O que testar:
- rerun da suite completa
- restart do backend
- retry de fan-out depois de restart

### Wave 48 - Shadow mode com dados reais e checklist de migracao

Objetivo:
- fazer ensaio controlado de operacao real antes de cutover

Entregaveis:
- modo de operacao paralela documentado
- checklist de shadow mode e de cutover
- comparacao curta `WA-notify` vs `LumeHub` para uma semana real
- pagina/estado para ver readiness de migracao

Criterios de aceitacao:
- uma semana real pode ser acompanhada em shadow mode sem regressao evidente
- os bloqueadores finais ficam visiveis e curtos
- o operador tem checklist objetiva para decidir cutover

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave48`

Melhor momento para testar:
- quando as waves anteriores estiverem fechadas e a suite ja estiver verde

O que testar:
- uma semana real em paralelo
- comparacao de eventos, envios e respostas
- readiness final de migracao

### Wave 49 - Limpeza final da ronda de paridade de migracao

Objetivo:
- fechar a ronda sem backlog falso, scripts obsoletos nem docs desfasadas

Entregaveis:
- consolidacao de validadores desta ronda
- limpeza de docs e copy de transicao
- plano ativo reduzido de novo ao que sobrar

Criterios de aceitacao:
- nao ficam referencias a estados intermedios
- docs e backlog refletem o estado real de migracao

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave49`

Melhor momento para testar:
- no fim da ronda, como regressao curta e documental

O que testar:
- estado geral da app
- docs de migracao
- ausencia de lixo tecnico da ronda

## Como reabrir uma ronda

Antes de abrir uma wave nova, ler:

1. `/home/eliaspc/Documentos/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/lume-hub/README.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro
6. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md`

## Regra para waves futuras

Se surgir uma nova wave:

- terminar sempre com rebuild real do que foi tocado
- criar `validate:waveX` em `source/package.json`
- criar `scripts/validate-waveX.mjs`
- declarar explicitamente quando vale a pena o utilizador testar
- se houver edicao de frontend:
  - recarregar a rota mexida num browser headless
  - confirmar que a UI monta
  - confirmar que nao ha ecra branco
  - confirmar que nao ha erro relevante de runtime/consola
- se for aberta uma nova ronda:
  - reservar desde logo a ultima wave dessa ronda para limpeza final
  - essa wave deve remover lixo tecnico e documental criado ou tornado obsoleto pela propria ronda

Rebuild minimo esperado:

- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se tocar backend, HTTP, WS ou runtime:

- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada

## Fora de scope por defeito

- reintroduzir `alerts` e `automations` no workspace

Essas areas so devem voltar se houver necessidade real de produto, desenho novo e validacao propria.
