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

A base do monorepo ja existe e as `Wave 0` a `Wave 43` foram executadas.
Hoje esta pasta ja contem:

- `apps/lume-hub-backend`, `apps/lume-hub-web` e `apps/lume-hub-host`
- packages de `foundation`, `adapters`, `modules` e `ui-modules` com contratos e implementacoes reais
- testes unitarios, de integracao e `e2e`
- scripts operacionais de validacao final e release:
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

Nota operacional:

- neste host, a validacao foi feita com `Node 20` local em `/opt/node-v20-current`
- o `node` global do sistema continua separado desta workspace

## Build target

O output desta pasta deve ser publicado para `../runtime/lxd/` e nunca tratado como runtime final em si.
