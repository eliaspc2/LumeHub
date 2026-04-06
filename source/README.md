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

A base do monorepo ja existe e as `Wave 0` a `Wave 57` foram executadas.
Hoje esta pasta ja contem:

- `apps/lume-hub-backend`, `apps/lume-hub-web` e `apps/lume-hub-host`
- packages de `foundation`, `adapters`, `modules` e `ui-modules` com contratos e implementacoes reais
- testes unitarios, de integracao e `e2e`
- scripts operacionais de validacao final e release:
  - `validate:wave57`
  - `validate:wave56`
  - `validate:wave55`
  - `validate:wave54`
  - `validate:wave53`
  - `validate:wave52`
  - `validate:wave51`
  - `validate:wave49`
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

A ronda de paridade e migracao do `WA-notify` tambem ficou fechada:

- a LLM live ficou ativa por defeito quando a auth existe
- o assistente passou a fazer `preview` e `apply` reais sobre schedules
- o importador de `wNNyYYYY.json` ficou idempotente e operacional em `Configuracao`
- `alerts` e `automations` ficaram portados para a arquitetura nova
- `pnpm run test` ficou verde com hardening de restart/cutover
- a pagina `Configuracao` ficou como area secundaria para imports legacy e ajustes base
- a pagina `Migracao` passou a concentrar readiness live, checklist de shadow mode e GUI do `codex auto router`
- a API expoe `GET /api/migrations/readiness`
- a semana paralela ficou descrita em `docs/deployment/lume_hub_shadow_mode_checklist.md`
- a `Wave 52` fechou a fundacao do modelo `group-first`
- a `Wave 53` fechou a shell `group-first` com switcher global de grupo e navegacao principal curta
- a `Wave 54` fechou a pagina operacional de grupo com owner, modos e politicas locais persistentes
- a `Wave 55` fechou a rota `/week` como calendario semanal com grelha por dia, estados canonicos e acoes inline
- a `Wave 56` fechou o roteamento por modo de grupo entre calendario, assistente e distribuicao
- a `Wave 57` fechou o ownership por grupo e a politica de interacao com o bot, com enforcement real e auditoria de permissao efetiva
- grupos `distribuicao_apenas` saem do scheduling local e passam a fan-out/distribuicao
- a validacao consolidada mais recente do backlog ativo passou a ser `validate:wave57`

Na ronda curta de operacao de migracao, agora ja fechada:

- a `Wave 50` ja deixou a rota `/migration` na navegacao principal
- o `codex auto router` ja tem GUI live para `prepare` e `switch`
- a `Wave 51` removeu copy e validadores obsoletos da ronda
- a `Wave 52` fechou os contratos canonicos dessa nova serie
- a `Wave 53` abriu a shell nova com rota base por grupo e switcher global de grupo
- a `Wave 54` transformou a pagina `/groups/:groupJid` numa pagina operacional com owner, modos e politicas locais

Nota operacional:

- neste host, a validacao foi feita com `Node 20` local em `/opt/node-v20-current`
- o `node` global do sistema continua separado desta workspace

## Build target

O output desta pasta deve ser publicado para `../runtime/lxd/` e nunca tratado como runtime final em si.
