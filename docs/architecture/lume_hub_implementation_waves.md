# Lume Hub Implementation Waves

Este ficheiro define a ordem recomendada de implementacao do `Lume Hub`.
Serve para uma LLM ou equipa executar o projeto por fases, sem misturar fundamentos com features tardias.

## Regras de leitura

Antes de implementar qualquer wave, ler:

1. `/home/eliaspc/Documentos/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/lume-hub/README.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro

## Pontos importantes acrescentados

Coisas que nao devem ficar esquecidas durante a implementacao:

1. timezone explicita
   - default `Europe/Lisbon`
   - guardada em settings e visivel na UI
2. schema version por ficheiro de calendario por grupo
   - cada `calendar/2026-03.json` deve incluir `schemaVersion`
   - migrations de ficheiro devem ser suportadas
3. escrita atomica e lock
   - nunca escrever ficheiros canonicos do grupo diretamente sem lock
4. reconciliacao apos restart
   - jobs em `waiting_confirmation` devem ser revistos no arranque
5. supressao granular
   - deve ser possivel desativar um aviso sem apagar o evento base
6. cleanup com arquivo, nao so delete cego
   - eventos/avisos passados devem sair da vista ativa, mas com politica clara de arquivo
7. heartbeat entre `lume-hub-backend` e `lume-hub-host`
   - para diagnosticar se o companion local caiu
8. modo de teste
   - deve existir forma de testar entregas sem mexer na regra real de producao

## Wave 0 - Scaffold e contratos

Objetivo:
- montar o monorepo
- criar apps e packages vazios
- definir contratos publicos minimos

Entregaveis:
- `source/package.json`
- `source/pnpm-workspace.yaml`
- `apps/lume-hub-backend`
- `apps/lume-hub-web`
- `apps/lume-hub-host`
- `packages/foundation/*`
- `packages/adapters/*`
- `packages/modules/*`

Criterios de aceitacao:
- `pnpm install` funciona
- `pnpm -r typecheck` corre sem erro
- nenhum modulo depende de implementacoes concretas de outro modulo

## Wave 1 - Foundation e persistence-group-files

Objetivo:
- criar kernel base
- criar config/logging/event bus
- implementar o adapter canonico de workspaces por grupo

Entregaveis:
- `foundation/kernel`
- `foundation/config`
- `foundation/logging`
- `foundation/events`
- `adapters/persistence-group-files`

Criterios de aceitacao:
- consegue criar e ler `data/groups/_settings.json`
- consegue criar e ler `data/groups/120363407086801381@g.us/calendar/2026-03.json`
- escrita e atomica
- existe lock por ficheiro canonico do grupo
- existe validacao de schema e `schemaVersion`

## Wave 2 - Dominio scheduling

Objetivo:
- implementar semanas, eventos, regras e jobs

Entregaveis:
- `modules/schedule-weeks`
- `modules/schedule-events`
- `modules/notification-rules`
- `modules/notification-jobs`

Regras minimas:
- numero variavel de avisos por evento
- defaults:
  - `24h antes`
  - `30 min antes`
- suporte a regra `fixed_local_time`

Criterios de aceitacao:
- cria evento base
- materializa `0..N` jobs derivados
- os estados visiveis do job sao:
  - `pending`
  - `waiting_confirmation`
  - `sent`

## Wave 3 - WhatsApp e delivery tracker

Objetivo:
- integrar Baileys
- normalizar inbound/outbound
- reconciliar entregas

Entregaveis:
- `adapters/whatsapp-baileys`
- `modules/delivery-tracker`

Criterios de aceitacao:
- mensagens inbound normalizadas
- outbound com observacao e confirmacao separados
- nao marca `sent` cedo demais
- no restart revê jobs `waiting_confirmation`

## Wave 4 - Dispatcher e watchdog

Objetivo:
- enviar jobs no momento certo
- vigiar atrasos e problemas

Entregaveis:
- scheduler/dispatcher
- `modules/watchdog`
- `modules/health-monitor`

Criterios de aceitacao:
- nunca faz tick concorrente sobre o mesmo job
- abre issue quando um job passa `x` minutos de `sendAt` sem chegar a `sent`
- nao duplica envios por retry precipitado

## Wave 5 - Host companion

Objetivo:
- implementar o lado do proprio PC

Entregaveis:
- `apps/lume-hub-host`
- `modules/system-power`
- `modules/host-lifecycle`
- manifests em `runtime/host/systemd-user`

Criterios de aceitacao:
- consegue instalar/remover arranque automatico
- consegue gerir politica anti-sleep
- gere o mesmo `/home/eliaspc/.codex/auth.json` usado pelo Codex
- expõe heartbeat/estado para o backend

## Wave 6 - HTTP, WS e painel minimo

Objetivo:
- tornar o sistema administravel

Entregaveis:
- `adapters/http-fastify`
- `adapters/ws-fastify`
- web shell minimo
- pagina de semana
- pagina de watchdog
- pagina de settings

Criterios de aceitacao:
- UI mostra semana ativa
- UI mostra jobs por estado
- GUI permite configurar:
  - avisos default
  - politica anti-sleep
  - arrancar com o sistema

## Wave 7 - Agent runtime e conversa

Objetivo:
- implementar a parte conversacional e de agente

Entregaveis:
- `modules/assistant-context`
- `modules/llm-orchestrator`
- `modules/agent-runtime`
- `modules/conversation`
- `modules/intent-classifier`
- `modules/command-policy`

Criterios de aceitacao:
- responde em privado e grupo com contexto
- gera acoes estruturadas
- nao deixa a LLM ser fonte de verdade do dominio

## Wave 8 - OAuth router e memoria

Objetivo:
- fechar conta, auth e memoria

Entregaveis:
- `modules/codex-auth-router`
- `modules/people-memory`
- `modules/group-directory`
- `modules/discipline-catalog`

Criterios de aceitacao:
- troca atomica e auditavel do auth live
- uso do mesmo auth do Codex
- leitura de grupos e catalogo pronta para o dominio

## Wave 9 - Hardening, testes e arquivo

Objetivo:
- estabilizar antes de producao

Entregaveis:
- testes unitarios
- testes de integracao
- testes e2e
- politica de arquivo e cleanup

Criterios de aceitacao:
- restart nao causa duplicacoes
- cleanup de eventos passados e previsivel
- watchdog e host companion aparecem bem no dashboard

## Wave 10 - Packaging e deploy

Objetivo:
- preparar execucao real

Entregaveis:
- build do backend
- build do host companion
- bundle para `runtime/lxd/release-bundles`
- instrucoes finais de publicacao

Criterios de aceitacao:
- backend pode correr em `LXD`
- `lume-hub-host` pode correr no host
- mounts de auth, data e logs estao claros

## Regra de execucao para a LLM

- completar uma wave antes de saltar para a seguinte
- no fim de cada wave:
  - atualizar docs locais relevantes
  - validar com testes/typecheck
  - deixar estado explicito do que ficou pronto e do que falta
