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

A base do monorepo ja existe e as `Wave 0` a `Wave 36` foram executadas.
Hoje esta pasta ja contem:

- `apps/lume-hub-backend`, `apps/lume-hub-web` e `apps/lume-hub-host`
- packages de `foundation`, `adapters`, `modules` e `ui-modules` com contratos e implementacoes reais
- testes unitarios, de integracao e `e2e`
- scripts operacionais de validacao final e release:
  - `validate:wave36`
  - `validate:wave35`
  - `validate:wave34`
  - `validate:wave29`
  - `validate:release`
  - `package:release`

A ronda de inteligencia por grupo ficou fechada, o storage canonico de media recebida tambem, o ingest live com biblioteca operacional ficou concluido, a distribuicao multi-grupo de media ja existe no runtime, e o fluxo guiado da pagina `Media` ja esta funcional.
A ronda de media distribuida tambem ficou fechada com limpeza final de docs, naming e validadores.
A ronda atual de simplificacao do GUI ja fechou a shell minima e a simplificacao das paginas principais; o foco que sobra esta em esconder melhor a configuracao avancada.

Nota operacional:

- neste host, a validacao foi feita com `Node 20` local em `/opt/node-v20-current`
- o `node` global do sistema continua separado desta workspace

## Build target

O output desta pasta deve ser publicado para `../runtime/lxd/` e nunca tratado como runtime final em si.
