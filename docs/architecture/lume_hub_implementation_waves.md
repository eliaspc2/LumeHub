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
9. escala multi-grupo
   - nao assumir que o produto fica por `2-3` grupos
   - o diretório de grupos deve aguentar crescimento sem hardcodes
10. fan-out por pessoa/remetente
   - uma mensagem pode precisar de ser distribuida para `N` grupos destino
11. idempotencia de distribuicao
   - a chave operacional deve distinguir `mensagem origem + grupo destino`
12. falha parcial controlada
   - falhar um grupo nao pode bloquear os restantes
13. ACL explicita do calendario
   - distinguir `group`, `group_owner` e `app_owner`
   - mutacoes do calendario nunca devem contornar estes niveis
   - os modos canonicos devem ser `read` e `read_write`

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

## Replaneamento a partir da Wave 6

As `Wave 0` a `Wave 5` mantêm-se validas.
A partir daqui, a ordem muda para suportar escala multi-grupo e fan-out por pessoa/remetente antes da UI e da camada conversacional completa.

## Wave 6 - Diretório, catalogo e routing multi-grupo

Objetivo:
- deixar o dominio preparado para muitos grupos e roteamento declarativo de destinatarios

Entregaveis:
- `modules/group-directory`
- `modules/discipline-catalog`
- `modules/people-memory`
- `modules/audience-routing`

Criterios de aceitacao:
- consegue catalogar muitos grupos sem lista fixa no codigo
- consegue resolver uma pessoa/remetente para `N` grupos destino
- consegue produzir preview de distribuicao antes de enviar
- o catalogo inicial de grupos/cursos e tratado como seed, nao como limite
- cada grupo pode definir `group owner` e policy local de acesso ao calendario
- o sistema distingue `app owner` de `group owner` logo nesta wave
- a policy do calendario por grupo distingue pelo menos:
  - `group -> read/read_write`
  - `group_owner -> read/read_write`
  - `app_owner -> read/read_write`

## Wave 7 - Fan-out e controlo operacional

Objetivo:
- transformar uma mensagem origem num plano real de distribuicao multi-grupo

Entregaveis:
- motor de `fan-out/distribution`
- `modules/command-policy`
- `modules/instruction-queue`
- `modules/owner-control`
- `modules/intent-classifier`

Criterios de aceitacao:
- uma mensagem origem pode criar `N` entregas alvo
- existe dedupe por `mensagem origem + grupo destino`
- falha num alvo nao bloqueia os restantes
- existe modo `preview/dry-run` e modo confirmado
- mutacoes do calendario respeitam ACL:
  - `group`
  - `group_owner`
  - `app_owner`
- as operacoes distinguem explicitamente pedido de:
  - `read`
  - `read_write`
- terminal e controlo global continuam exclusivos do `app owner`

## Wave 8 - HTTP, WS e painel minimo

Objetivo:
- tornar o sistema administravel no novo modelo multi-grupo

Entregaveis:
- `adapters/http-fastify`
- `adapters/ws-fastify`
- web shell minimo
- pagina de grupos
- pagina de routing fan-out
- pagina de watchdog
- pagina de settings

Criterios de aceitacao:
- UI mostra grupos conhecidos e regras de routing
- UI mostra campanhas/distribuicoes por estado
- GUI permite configurar:
  - avisos default
  - politica anti-sleep
  - arrancar com o sistema
  - regras de fan-out por pessoa/remetente
  - `group owners`
  - ACL do calendario por grupo

## Wave 9 - Agent runtime e conversa

Objetivo:
- implementar a parte conversacional e de agente por cima do modelo multi-grupo

Entregaveis:
- `modules/assistant-context`
- `modules/llm-orchestrator`
- `modules/agent-runtime`
- `modules/conversation`

Criterios de aceitacao:
- responde em privado e grupo com contexto
- pode sugerir/acionar fan-out quando a politica permitir
- nao deixa a LLM ser fonte de verdade do dominio

## Wave 10 - OAuth router

Objetivo:
- fechar conta e auth com o novo modelo ja assente

Entregaveis:
- `modules/codex-auth-router`

Criterios de aceitacao:
- troca atomica e auditavel do auth live
- uso do mesmo auth do Codex
- impacto operacional claro no companion e no backend

## Wave 11 - Hardening, testes e arquivo

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
- restart nao duplica fan-out para o mesmo `source message + target group`
- fan-out parcial falhado pode ser reprocessado sem reenviar o que ja foi confirmado

## Wave 12 - Packaging e deploy

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

## Replaneamento frontend a partir da Wave 13

As `Wave 0` a `Wave 12` continuam uteis como base de dominio, runtime e deploy.
Mas para o produto ficar realmente utilizavel por pessoas com poucos conhecimentos tecnicos, o frontend precisa de uma fase propria de redesenho.

Estas waves novas nao substituem o trabalho anterior.
Servem para modernizar a experiencia e aproximar o produto da usabilidade real.

## Wave 13 - Frontend foundation moderna

Objetivo:
- substituir o shell textual por uma web app moderna
- criar identidade visual, layout e design system consistentes

Entregaveis:
- migracao de `apps/lume-hub-web` para SPA real
- shell principal moderno
- design system local
- navegacao principal baseada em tarefas
- estados globais de sessao:
  - loading
  - empty
  - offline
  - erro

Regras obrigatorias:
- desenhar para utilizador pouco tecnico
- linguagem simples
- mobile e desktop legiveis
- detalhes tecnicos ficam em modo secundario

Navegacao minima esperada:
- `Hoje`
- `Semana`
- `Assistente`
- `Distribuicoes`
- `Entregas`
- `Watchdog`
- `Grupos`
- `WhatsApp`
- `Configuracao`

Criterios de aceitacao:
- a app corre num browser real
- existe layout moderno com sidebar, header e painel contextual opcional
- a pagina inicial `Hoje` responde claramente:
  - se o WhatsApp esta ligado
  - se ha falhas
  - qual e a proxima acao recomendada
- o frontend ja nao parece um painel tecnico datado

## Wave 14 - Fluxos guiados de operacao

Objetivo:
- tornar as tarefas principais executaveis sem conhecimento interno do sistema

Entregaveis:
- fluxo guiado para criar/editar agendamentos
- fluxo guiado para fan-out multi-grupo
- fluxo guiado para resolver falhas comuns
- quick actions na home
- empty states e mensagens de erro humanas

Fluxos minimos:
- `Criar agendamento`
- `Distribuir mensagem`
- `Ligar ou reparar WhatsApp`
- `Resolver problema watchdog`

Criterios de aceitacao:
- as tarefas principais podem ser feitas sem expor `jid`, ids internos ou nomes de modulo
- existe preview antes de acoes destrutivas ou multi-grupo
- a UI sugere o proximo passo em vez de obrigar o utilizador a navegar as cegas

## Wave 15 - Permissoes, ownership e WhatsApp UX

Objetivo:
- tornar ownership, ACL e configuracao WhatsApp compreensiveis para humanos

Entregaveis:
- consola WhatsApp redesenhada
- gestao visual de:
  - `app owner`
  - `group owner`
  - ACL `read` / `read_write`
- lista de grupos e conversas com labels humanas
- onboarding de sessao WhatsApp com QR, estado e recuperacao guiada

Criterios de aceitacao:
- um utilizador nao tecnico percebe quem pode fazer o que sem ler documentacao
- a configuracao de permissoes acontece por seletores e passos guiados
- a ligacao WhatsApp mostra estado, causa provavel de erro e sugestao de resolucao

## Wave 16 - Polimento, acessibilidade e confianca operacional

Objetivo:
- fechar a experiencia para uso real diario

Entregaveis:
- acessibilidade base
- refinamento visual
- microcopy final
- modo `advanced details`
- telemetria UX local suficiente para perceber erros frequentes

Checklist obrigatoria:
- contraste suficiente
- foco visivel
- navegacao por teclado razoavel
- labels e feedback claros
- confirmacoes para operacoes sensiveis
- historico e estado operacional explicados em linguagem simples

Criterios de aceitacao:
- uma pessoa com pouco conhecimento tecnico consegue usar a app para tarefas frequentes
- o modo avancado existe sem poluir a experiencia principal
- o frontend transmite confianca operacional e clareza

## Regra de execucao para a LLM

- completar uma wave antes de saltar para a seguinte
- no fim de cada wave:
  - atualizar docs locais relevantes
  - validar com testes/typecheck
  - deixar estado explicito do que ficou pronto e do que falta
