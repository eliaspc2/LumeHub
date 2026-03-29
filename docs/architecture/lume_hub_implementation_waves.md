# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 39` ja foram executadas e validadas.
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

As `Wave 35` a `Wave 39` ja foram executadas e validadas.
A ronda de simplificacao do GUI ficou fechada com shell minima, paginas principais mais curtas, configuracao avancada sob demanda e limpeza final dos validadores e do copy de transicao.

Ronda ativa:

### Wave 40 - Diffs e contexto guiado do agente de projeto

Objetivo:
- tornar a pagina `Projeto` mais segura e mais clara antes de cada aplicacao de alteracoes

Entregaveis:
- diff por ficheiro depois de cada run
- resumo estruturado de ficheiros lidos, ficheiros mudados e ficheiros sugeridos
- possibilidade de pedir ao agente para rever um ficheiro especifico sem o alterar
- visao mais clara de contexto antes de correr `apply`

Criterios de aceitacao:
- o operador percebe logo o que foi lido e o que foi alterado
- uma run com alteracoes passa a mostrar diff legivel por ficheiro
- o fluxo continua simples para quem nao quer detalhes tecnicos excessivos

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave40`

Melhor momento para testar:
- assim que a wave fechar, porque aqui ainda e barato corrigir a linguagem e a forma como o diff aparece

O que testar:
- pedir um plano sem alteracoes
- pedir uma alteracao pequena
- confirmar se percebes logo que ficheiros entraram e o que mudou

### Wave 41 - Aprovação, fila e guardrails operacionais

Objetivo:
- endurecer o uso do agente antes de o tratar como fluxo normal de produto

Entregaveis:
- aprovacao explicita antes de runs `apply`
- bloqueio de concorrencia para nao correr duas runs destrutivas ao mesmo tempo
- auditoria visivel do pedido, modo e resultado
- guardrails adicionais no backend para limitar operacoes fora do esperado

Criterios de aceitacao:
- nao e possivel disparar alteracoes destrutivas sem confirmacao
- duas runs `apply` nao concorrem ao mesmo tempo
- a auditoria recente permite perceber quem pediu o que e qual foi o resultado

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave41`

Melhor momento para testar:
- quando a UI da `Wave 40` ja estiver minimamente clara, porque aqui interessa validar risco operacional e confianca

O que testar:
- run `apply` com confirmacao
- tentativa de disparar duas runs seguidas
- leitura do historico e do estado de bloqueio

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
