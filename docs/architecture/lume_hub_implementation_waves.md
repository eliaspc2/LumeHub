# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 30` ja foram executadas e validadas.
O runtime `Live` atual continua funcional e a ronda de inteligencia por grupo ficou fechada com storage canonico, retrieval isolado, UI/API operacional, uso live auditavel e limpeza final.

O storage canonico da ronda de media ja ficou aberto com:

- `data/runtime/media/assets/<assetId>/binary`
- `data/runtime/media/assets/<assetId>/metadata.json`
- `data/runtime/media/library.json`

## Ronda ativa

### Wave 31 - Inbound WhatsApp media e biblioteca operacional

Objetivo:
- fazer o runtime reconhecer media inbound e expor uma biblioteca operacional de assets recebidos

Entregaveis:
- normalizacao inbound de media com suporte inicial a:
  - video
  - imagem
  - documento
  - audio opcional se o adapter suportar de forma estavel
- download/ingest do binario para o repositorio de media
- API para listar assets recentes e consultar metadata
- UI minima para ver biblioteca de media recebida

Criterios de aceitacao:
- ao receber um video por WhatsApp, ele aparece na biblioteca operacional
- o operador consegue identificar de que chat e mensagem veio o asset

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave31`

Melhor momento para testar:
- aqui, porque e a primeira vez em que o operador ja consegue ver o video guardado

O que testar:
- enviar um video para o bot
- abrir a biblioteca de media
- confirmar metadata, caption e origem

### Wave 32 - Distribuicao multi-grupo de media com queue e tracking

Objetivo:
- distribuir video guardado para varios grupos com o mesmo modelo de queue, dedupe e confirmacao que hoje existe para texto

Entregaveis:
- `instruction-queue` com novo tipo de acao para media
- `fanout` a aceitar `assetId` alem de `messageText`
- gateway WhatsApp com `sendMedia()` ou equivalente
- delivery tracker e reconciliacao a suportarem tentativas e confirmacoes de media
- dedupe por `assetId + targetGroupJid + sourceMessageId`

Criterios de aceitacao:
- um video guardado pode ser enfileirado para varios grupos
- retries nao duplicam envios para grupos ja entregues
- a distribuicao de media fica auditavel na queue

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave32`

Melhor momento para testar:
- aqui, porque e o primeiro ponto em que a feature principal passa a existir de facto

O que testar:
- distribuir um video guardado para varios grupos
- simular falha parcial e retry
- confirmar estado por alvo e ausencia de duplicacao

### Wave 33 - UI e fluxo guiado para distribuir video recebido

Objetivo:
- dar um fluxo simples para o operador escolher um video recebido e espalha-lo por grupos sem mexer em payloads tecnicos

Entregaveis:
- pagina ou secao de media no frontend
- selecao de asset recebido
- preview dos grupos alvo
- envio `dry_run` e `confirmed`
- visao do estado de entrega por grupo

Criterios de aceitacao:
- um operador pouco tecnico consegue:
  - encontrar o video recebido
  - escolher os grupos
  - disparar a distribuicao
  - perceber o que ficou entregue e o que falhou

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave33`

Melhor momento para testar:
- aqui, porque a feature ja fica utilizavel de ponta a ponta no produto

O que testar:
- fluxo completo de "receber video -> guardar -> selecionar -> distribuir"
- browser headless sem ecras brancos nem erros de runtime
- clareza da UI para operador nao tecnico

### Wave 34 - Limpeza final da ronda de media distribuida

Objetivo:
- fechar a ronda de media sem lixo tecnico, naming transitório ou validadores redundantes

Entregaveis:
- docs finais alinhadas ao modelo canonico de media
- remocao de codigo provisório ou nomenclatura transitória da ronda
- backlog residual reavaliado

Criterios de aceitacao:
- o repo fica limpo
- os comandos e docs operacionais ficam coerentes com o fluxo final

Rebuild e validacao minima:
- `corepack pnpm run validate:wave34`

Melhor momento para testar:
- no fim da ronda, para confirmar regressao geral do fluxo de media

O que testar:
- regressao de distribuicao de texto
- regressao do fluxo de media
- ausencia de residuos documentais e scripts supersedidos

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
