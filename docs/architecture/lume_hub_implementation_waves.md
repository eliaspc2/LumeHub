# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 34` ja foram executadas e validadas.
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

## Ronda ativa

Existe agora uma ronda ativa de simplificacao forte do GUI.
As `Wave 35` a `Wave 37` ja foram executadas e validadas.
O fluxo principal ficou mais curto, e a configuracao avancada passou para superficies secundarias sob demanda.

### Wave 38 - Limpeza final da ronda de simplificacao do GUI

Objetivo:
- fechar a ronda sem lixo tecnico nem documental

Entregaveis:
- remocao de helpers, copy e componentes ja supersedidos
- docs alinhadas com a shell simplificada
- validacao final da ronda

Criterios de aceitacao:
- o repositorio fica mais limpo do que no arranque da ronda
- nao ficam superficies antigas descritas como se ainda fossem o caminho principal

Rebuild e validacao minima:
- `corepack pnpm --filter @lume-hub/lume-hub-web typecheck`
- `corepack pnpm --filter @lume-hub/lume-hub-web build`
- reload headless das paginas principais
- `git diff --check`

Melhor momento para testar:
- no fecho da ronda

O que testar:
- regressao rapida de `Hoje`, `WhatsApp`, `Grupos` e `Media`
- confirmar que nao reapareceu ruido visual nem opcoes mortas

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
