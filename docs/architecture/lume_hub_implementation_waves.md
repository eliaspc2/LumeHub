# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 48` ja foram executadas e validadas.
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

A ronda do agente de projeto tambem ja ficou fechada com:

- pagina `/workspace` no frontend
- modulo `workspace-agent` no backend
- API live para pesquisar ficheiros, ler preview e correr runs do agente
- execucao real via `codex exec` limitada ao repo do `LumeHub`
- historico recente de runs e ficheiros alterados
- diff por ficheiro e contexto guiado antes de `apply`
- aprovacao explicita, bloqueio de concorrencia e auditoria visivel
- limpeza final de docs, naming e validadores da serie

## Estado do plano

As `Wave 35` a `Wave 42` ja foram executadas e validadas.
A ronda de simplificacao do GUI ficou fechada com shell minima, paginas principais mais curtas, configuracao avancada sob demanda e limpeza final dos validadores e do copy de transicao.
A `Wave 40` tambem ja fechou diffs por ficheiro, resumo estruturado de contexto e revisao guiada de ficheiro na pagina `Projeto`.
A `Wave 41` ja fechou aprovacao explicita para `apply`, bloqueio de concorrencia, auditoria visivel do pedido/modo/resultado e guardrails operacionais no backend e na UI.
A `Wave 42` fechou a limpeza final da ronda do agente de projeto, consolidando validadores, removendo copy provisoria e alinhando docs ao estado final da pagina `Projeto`.
A `Wave 43` fechou a LLM live por defeito, com provider real ativo quando a auth existe e fallback deterministico visivel e auditavel quando a auth falha.
A `Wave 44` fechou o scheduling live com `preview -> apply -> queue -> auditoria`, incluindo alteracao real do calendario por assistente e diff funcional visivel antes e depois do `apply`.
A `Wave 45` fechou o importador idempotente de schedules do `WA-notify`, com pagina operacional em `Configuracao`, relatorio de itens importados/ambiguos e migracao real para o storage mensal canonico por grupo.
A `Wave 46` fechou `alerts` e `automations` dentro da arquitetura nova, com import minimo de `alerts.json` e `automations.json`, execucao live, auditoria e pagina operacional em `Configuracao`.
A `Wave 47` fechou a suite verde e o hardening de restart/cutover, com `pnpm run test` a passar por completo e cobertura atualizada para o copy live mais recente.
A `Wave 48` fechou o shadow mode com dados reais:
- snapshot live de readiness em `Configuracao`
- checklist de shadow mode e de cutover
- comparacao curta `WA-notify` vs `LumeHub`
- validacao dedicada em `validate:wave48`

## Ronda de paridade e cutover WA-notify

Esta ronda existe para fechar os bloqueadores que ainda impedem migracao total do `WA-notify` para o `LumeHub`.

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

- abrir rondas novas sem bloqueador real validado
- reintroduzir stubs ou backlog falso para areas ja fechadas
