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

### Wave 36 - Simplificacao das paginas principais

Objetivo:
- cortar blocos secundarios dentro das paginas mais usadas
- deixar `Hoje`, `WhatsApp`, `Grupos` e `Media` muito mais diretas

Entregaveis:
- homepage com menos cartoes e menos resumo duplicado
- `WhatsApp` com menos explicacao repetida e menos controlos expostos
- `Grupos` com foco em acao principal e menos detalhe auxiliar
- `Media` com fluxo mais curto e menos leitura lateral

Criterios de aceitacao:
- cada pagina principal deve ter uma hierarquia obvia
- deve existir menos scrolling para chegar ao que interessa
- configuracoes secundarias devem sair do caminho principal

Rebuild e validacao minima:
- `corepack pnpm --filter @lume-hub/lume-hub-web typecheck`
- `corepack pnpm --filter @lume-hub/lume-hub-web build`
- reload headless de `/today`, `/whatsapp`, `/groups` e `/media`

Melhor momento para testar:
- no fim desta wave
- aqui vale a pena validar se o produto ja parece realmente simples para uso diario

O que testar:
- `Hoje`: se percebes logo o proximo passo
- `WhatsApp`: se ownership e sessao ficam claros sem ler muito
- `Grupos`: se a gestao do grupo cabe no espaco sem confusao
- `Media`: se escolher e distribuir um video parece fluxo curto

### Wave 37 - Configuracao avancada sob demanda

Objetivo:
- mover detalhe tecnico e configuracao menos frequente para superfícies secundarias
- manter o fluxo diario limpo sem perder capacidade

Entregaveis:
- detalhes avancados escondidos por defeito
- acoes menos frequentes agrupadas em zonas secundarias
- linguagem mais curta e menos termos internos expostos

Criterios de aceitacao:
- o fluxo diario nao obriga a atravessar configuracao
- o utilizador consegue operar sem ver ids, estados internos ou nomenclatura tecnica
- o detalhe continua acessivel quando realmente preciso

Rebuild e validacao minima:
- `corepack pnpm --filter @lume-hub/lume-hub-web typecheck`
- `corepack pnpm --filter @lume-hub/lume-hub-web build`
- reload headless das rotas mexidas

Melhor momento para testar:
- no fim desta wave
- aqui deves confirmar se a app ja parece produto final e nao ferramenta de setup

O que testar:
- se o fluxo do dia a dia continua completo sem entrares em configuracao
- se as opcoes avancadas ainda aparecem quando precisas
- se a linguagem ficou mais humana

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
