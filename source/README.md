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

A base do monorepo ja existe e as `Wave 0` a `Wave 17` foram executadas.
Hoje esta pasta ja contem:

- `apps/lume-hub-backend`, `apps/lume-hub-web` e `apps/lume-hub-host`
- packages de `foundation`, `adapters`, `modules` e `ui-modules` com contratos e implementacoes reais
- scripts de validacao de `validate:wave1` ate `validate:wave17`
- testes unitarios, de integracao e `e2e`

Nao ha uma wave ativa neste momento.
O backlog restante ficou concentrado em:

- gaps de integracao real descritos em `../docs/architecture/lume_hub_gap_audit.md`
- regressao final e trabalho futuro que venha a merecer waves novas

Nota operacional:

- neste host, a validacao foi feita com `Node 20` local em `/opt/node-v20-current`
- o `node` global do sistema continua separado desta workspace

## Build target

O output desta pasta deve ser publicado para `../runtime/lxd/` e nunca tratado como runtime final em si.
