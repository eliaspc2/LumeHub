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

O scaffold da `Wave 0` ja foi montado para permitir trabalho paralelo real.
As workspaces de `apps/`, `foundation/`, `adapters/`, `modules/` e `ui-modules/` ja existem com contratos publicos minimos, `package.json`, `tsconfig` e pontos de entrada TypeScript.

A `Wave 1` ja deixou implementacoes reais em:

- `foundation/kernel`
- `foundation/config`
- `foundation/logging`
- `foundation/events`
- `adapters/persistence-group-files`

Validacao base desta fase:

- `pnpm install`
- `pnpm -r typecheck`
- `pnpm run validate:wave1`

Nota operacional:

- neste host, a validacao foi feita com `Node 20` local em `/opt/node-v20-current`
- o `node` global do sistema continua separado desta workspace

## Build target

O output desta pasta deve ser publicado para `../runtime/lxd/` e nunca tratado como runtime final em si.
