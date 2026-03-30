# Source Tree

Esta pasta e a raiz do codigo-fonte do projeto novo.

## Objetivo

Montar um monorepo em `pnpm workspaces` com separacao real entre:

- `apps/`
- `packages/foundation/`
- `packages/adapters/`
- `packages/modules/`
- `packages/ui-modules/`

Apps esperadas:

- `apps/lume-hub-backend`
- `apps/lume-hub-web`
- `apps/lume-hub-host`

Decisao de storage:

- schedules canonicos em pastas por grupo
- cada grupo tem calendario mensal canonico
- `week_id` ISO continua dentro dos registos e das projections
- runtime auxiliar separado em `data/runtime`

## Regra arquitetural

- `apps/` so fazem bootstrap, composition root e runtime wiring.
- `apps/lume-hub-host` concentra integracao com o proprio PC.
- `foundation/` contem contratos, kernel e utilitarios transversais.
- `adapters/` encapsulam bibliotecas externas e integracoes concretas.
- `modules/` contem dominio e casos de uso.
- `ui-modules/` contem features reutilizaveis do frontend.

## Estado

A base do monorepo ja existe e as `Wave 0` a `Wave 48` foram executadas.
Hoje esta pasta ja contem:

- `apps/lume-hub-backend`, `apps/lume-hub-web` e `apps/lume-hub-host`
- packages de `foundation`, `adapters`, `modules` e `ui-modules` com contratos e implementacoes reais
- testes unitarios, de integracao e `e2e`
- scripts operacionais de validacao final e release:
  - `validate:wave45`
  - `validate:wave48`
  - `validate:wave44`
  - `validate:wave43`
  - `validate:wave42`
  - `validate:wave38`
  - `validate:wave34`
  - `validate:wave29`
  - `validate:release`
  - `package:release`

A ronda de inteligencia por grupo ficou fechada, o storage canonico de media recebida tambem, o ingest live com biblioteca operacional ficou concluido, a distribuicao multi-grupo de media ja existe no runtime, e o fluxo guiado da pagina `Media` ja esta funcional.
A ronda de media distribuida tambem ficou fechada com limpeza final de docs, naming e validadores.
A ronda de simplificacao do GUI ficou fechada com shell minima, paginas principais mais curtas, configuracao avancada sob demanda e limpeza final dos validadores e do copy de transicao.
Tambem ja existe o fluxo operacional do agente de projeto:

- modulo `@lume-hub/workspace-agent`
- API `/api/workspace/*`
- pagina `/workspace`
- runs `plan` e `apply` sobre o repo do `LumeHub`
- diff por ficheiro depois de cada run
- resumo estruturado de ficheiros lidos, ficheiros mudados e ficheiros sugeridos
- fluxo guiado para rever um ficheiro especifico sem o alterar
- confirmacao explicita antes de `apply`
- bloqueio de concorrencia para runs destrutivas
- auditoria de `requestedBy`, aprovacao, execucao e guardrail
- endpoint `/api/workspace/status`
- validacao consolidada em `validate:wave42`

A `Wave 43` tambem ja ficou fechada:

- o runtime live usa `codex-oauth` por defeito quando a auth existe
- a pagina `Configuracao` mostra provider efetivo, modelo e readiness de auth
- o fallback para `local-deterministic` ficou visivel e auditavel
- a validacao dedicada passou em `validate:wave43`

A `Wave 44` tambem ja ficou fechada:

- o assistente consegue gerar `preview` de scheduling e aplicar alteracoes reais no calendario do grupo
- o caminho `assistente -> queue -> persistencia` ficou operacional para criar, editar e apagar schedules reais
- a pagina `Assistente` mostra diff funcional antes do `apply` e auditoria recente das alteracoes aplicadas
- a validacao dedicada passou em `validate:wave44`

A `Wave 45` tambem ja ficou fechada:

- o `weekly-planner` ganhou importador idempotente do formato semanal legacy do `WA-notify`
- a pagina `Configuracao` ja permite listar ficheiros legacy, gerar preview e aplicar a migracao real
- os events importados passam para o storage mensal canonico por grupo
- a validacao dedicada passou em `validate:wave45`

A `Wave 46` tambem ja ficou fechada:

- os modulos `message-alerts` e `automations` passaram a existir de forma canonica no workspace
- a pagina `Configuracao` ja permite preview/apply de `alerts.json` e `automations.json`
- o runtime live ja executa `alerts` por inbound e `automations` por tick, com auditoria em API/UI
- a validacao dedicada passou em `validate:wave46`

A `Wave 47` tambem ja ficou fechada:

- `pnpm run test` passou por completo no workspace
- o caso de restart/dedupe da `instruction-queue` ficou corrigido e coberto pelo teste de integracao
- o e2e live de cutover ficou alinhado ao copy atual da UI
- a validacao dedicada passou em `validate:wave47`

A `Wave 48` tambem ja ficou fechada:

- a pagina `Configuracao` mostra readiness live de migracao com dados reais
- a API expoe `GET /api/migrations/readiness`
- existe checklist explicita para semana paralela em `docs/deployment/lume_hub_shadow_mode_checklist.md`
- o cutover passou a depender da execucao real do shadow mode, e nao de backlog tecnico em aberto
- a validacao dedicada passou em `validate:wave48`

Nota operacional:

- neste host, a validacao foi feita com `Node 20` local em `/opt/node-v20-current`
- o `node` global do sistema continua separado desta workspace

## Build target

O output desta pasta deve ser publicado para `../runtime/lxd/` e nunca tratado como runtime final em si.
