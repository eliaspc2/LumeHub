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

A base do monorepo ja existe e as `Wave 0` a `Wave 60` foram executadas.
Hoje esta pasta ja contem:

- `apps/lume-hub-backend`, `apps/lume-hub-web` e `apps/lume-hub-host`
- packages de `foundation`, `adapters`, `modules` e `ui-modules` com contratos e implementacoes reais
- testes unitarios, de integracao e `e2e`
- scripts operacionais de validacao final e release:
  - `validate:wave70`
  - `validate:wave69`
  - `validate:wave68`
  - `validate:wave67`
  - `validate:wave60`
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
A ronda de simplificacao do GUI ficou fechada:
- a `Wave 61` fechou a base de composicao e densidade
- a `Wave 62` simplificou a pagina `LLM`
- a `Wave 63` alinhou a linguagem da shell e o `codex auto router`
- a `Wave 64` migrou `WhatsApp`, `LumeHub`, `Migracao` e vistas principais de grupo para os novos objetos compactos
- a `Wave 65` removeu restos de transicao, consolidou `validate:wave65` e fechou a ronda
- a ronda `commercial-readiness` ja fechou a `Wave 66` com homepage e estados humanos, a `Wave 67` com `Calendario` summary-first e `LLM` chat-first, a `Wave 68` com lembretes por grupo e copy assistida pela LLM, a `Wave 69` com `Grupos` e `WhatsApp` como fluxos guiados e a `Wave 70` com `LumeHub`, `Codex Router` e `Migracao` separados por papel
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
- a pagina `Migracao` passou a concentrar readiness live e checklist de shadow mode, enquanto o `Codex Router` vive em pagina propria
- a API expoe `GET /api/migrations/readiness`
- a semana paralela ficou descrita em `docs/deployment/lume_hub_shadow_mode_checklist.md`
- a `Wave 52` fechou a fundacao do modelo `group-first`
- a `Wave 53` fechou a shell `group-first` com switcher global de grupo e navegacao principal curta
- a `Wave 54` fechou a pagina operacional de grupo com owner, modos e politicas locais persistentes
- a `Wave 55` fechou a rota `/week` como calendario semanal com grelha por dia, estados canonicos e acoes inline
- a `Wave 56` fechou o roteamento por modo de grupo entre calendario, assistente e distribuicao
- a `Wave 57` fechou o ownership por grupo e a politica de interacao com o bot, com enforcement real e auditoria de permissao efetiva
- a `Wave 58` separou a pagina `WhatsApp` da pagina `LumeHub` e empurrou imports legacy para `Migracao`
- a `Wave 59` fechou a pagina `LLM` como chat direto com escopo global ou de grupo, `memoryScope` auditavel e separacao clara entre conversa segura e `preview/apply`
- a `Wave 60` fechou a limpeza final da ronda `group-first`, consolidando `validate:wave60` e removendo validadores intermédios `52..59`
- a ronda `ui-clarity` abriu com a `Wave 61`, dedicada a contratos base de composicao, densidade e consistencia visual da shell
- a `Wave 62` passa a usar essa base para refazer a pagina `LLM`, separando melhor `perguntar`, `agir` e `auditar`
- a `Wave 63` simplifica a linguagem da shell, empurra detalhe tecnico para segundo plano e deixa o `codex auto router` pronto para listar `3+` tokens
- a `Wave 64` migra a shell restante para listas de estado, blocos compactos e estados vazios coerentes nas paginas `WhatsApp`, `LumeHub`, `Migracao` e `Grupos`
- a `Wave 65` fecha a ronda `ui-clarity`, remove validadores intermédios `61..64` e deixa `validate:wave65` como entrada canonica da serie
- a `Wave 66` abre a ronda `commercial-readiness` com homepage real e estados de carga mais humanos
- a `Wave 67` fecha `Calendario` e `LLM` como fluxos mais operacionais
- a `Wave 68` fecha lembretes por grupo, janelas temporais e copy assistida pela LLM
- a `Wave 69` fecha `Grupos` e `WhatsApp` como fluxos guiados
- a `Wave 70` fecha `LumeHub`, `Codex Router` e `Migracao` por papel, e deixa `validate:wave70` como entrada canonica atual
- grupos `distribuicao_apenas` saem do scheduling local e passam a fan-out/distribuicao
- a validacao consolidada mais recente passou a ser `validate:wave70`

Na ronda curta de operacao de migracao, agora ja fechada:

- a `Wave 50` ja deixou a rota `/migration` na navegacao principal
- o `codex auto router` ja tem GUI live para `prepare` e `switch`
- a `Wave 51` removeu copy e validadores obsoletos da ronda

Na ronda `group-first`, agora ja fechada:

- as `Wave 52` a `Wave 59` fecharam modelo, shell, pagina de grupo, calendario semanal, roteamento, ownership, separacao de settings e chat direto com a LLM
- a `Wave 60` fechou a limpeza final e deixou `validate:wave60` como entrada canonica da serie

Nota operacional:

- neste host, a validacao foi feita com `Node 20` local em `/opt/node-v20.20.1-linux-x64/bin`
- o `node` global do sistema continua separado desta workspace

## Build target

O output desta pasta deve ser publicado para `../runtime/lxd/` e nunca tratado como runtime final em si.
