# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara

## Estado atual

As `Wave 0` a `Wave 17` ja foram executadas e validadas.
O backlog restante foi agora reagrupado em novas waves de fecho para runtime real.

As waves ativas passam a ser:

- `Wave 18`
- `Wave 19`
- `Wave 20`
- `Wave 21`
- `Wave 22`
- `Wave 23`

Objetivo desta nova ronda:

- sair de `demo shell + wiring parcial`
- chegar a backend real, API real, WhatsApp live, LLM real e cutover operacional

## Regras de leitura

Antes de abrir uma wave nova, ler:

1. `/home/eliaspc/Documentos/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/lume-hub/README.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro
6. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md`

## Pontos que continuam fechados

1. timezone explicita
   - default `Europe/Lisbon`
   - guardada em settings e visivel na UI
2. schema version por ficheiro de calendario por grupo
   - cada `calendar/YYYY-MM.json` inclui `schemaVersion`
3. escrita atomica e lock
   - nao escrever ficheiros canonicos diretamente sem lock
4. reconciliacao apos restart
   - jobs em `waiting_confirmation` devem ser revistos no arranque
5. supressao granular
   - deve ser possivel desativar um aviso sem apagar o evento base
6. cleanup com arquivo
   - eventos/avisos passados saem da vista ativa com politica clara de arquivo
7. heartbeat entre `lume-hub-backend` e `lume-hub-host`
8. modo de teste
   - deve existir forma de testar entregas sem mexer na regra real de producao
9. escala multi-grupo
   - nao assumir um conjunto pequeno fixo de grupos
10. fan-out por pessoa/remetente
11. idempotencia por `mensagem origem + grupo destino`
12. falha parcial controlada
13. ACL explicita do calendario com `group`, `group_owner` e `app_owner`

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

Rebuild minimo esperado:

- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se tocar backend, HTTP, WS ou runtime:

- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada

## Waves ativas

## Wave 18 - Composition root e runtime real do backend

Objetivo:
- substituir o bootstrap placeholder por composition root real do produto

Entregaveis:
- `ModuleLoader` com carga real de modules e adapters
- `ModuleGraphBuilder` com ordem/dependencias declaradas
- `KernelFactory` a criar runtime real do backend
- `AppBootstrap` a subir backend funcional e nao apenas processo vivo
- configuracao minima de runtime para host, paths, ticks e modulos base

Criterios de aceitacao:
- o backend arranca e pára sem placeholders estruturais
- `dashboard`, `settings`, `groups` e `watchdog` ficam acessiveis a partir do runtime real
- o runtime usa os modulos reais ja existentes em vez de `[]` ou wiring vazio

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave18`

Melhor momento para testar:
- testar aqui, porque e a melhor altura para apanhar conflitos de wiring sem ainda misturar WhatsApp live ou LLM real

O que testar:
- arranque e paragem do backend
- leitura de health/dashboard reais
- ausencia de crash no arranque e no idle
- consistencia entre `host lifecycle`, `system power`, `watchdog` e `settings`

## Wave 19 - HTTP, WS e modo live verdadeiro

Objetivo:
- trocar o modo `live` de preview parcial por runtime de rede real

Entregaveis:
- `http-fastify` com `listen(host, port)` real
- `ws-fastify` com endpoint WebSocket real e feed de eventos operacionais
- serving real da web app pelo backend ou por runtime acoplado claramente configurado
- launcher a abrir o `Live` verdadeiro em vez do fallback de demo
- erros live humanos e observaveis sem `JSON.parse` cru nem HTML indevido onde era esperado JSON

Criterios de aceitacao:
- a app abre em `Live` e carrega dados do backend real
- o browser deixa de depender de modo demo para navegar nas paginas principais
- eventos operacionais chegam via WS real

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave19`

Melhor momento para testar:
- testar aqui e essencial, porque e o primeiro ponto em que o `Live` passa a significar mesmo runtime real

O que testar:
- abrir a app em `Live`
- navegar por `Hoje`, `WhatsApp`, `Semana` e `Configuracao`
- confirmar que nao ha ecras brancos nem erros de parse
- confirmar que eventos live chegam ao frontend

## Wave 20 - WhatsApp live, QR e descoberta

Objetivo:
- ligar o canal WhatsApp real ao produto

Entregaveis:
- socket Baileys real com reconnect policy
- QR login real e respetivas rotas/eventos
- descoberta live de grupos e conversas privadas
- sincronizacao do workspace WhatsApp para `group-directory` e `people-memory`
- envio real com sinais de observacao e confirmacao forte

Criterios de aceitacao:
- o utilizador consegue autenticar a sessao WhatsApp
- grupos e conversas aparecem na UI a partir de dados reais
- o sistema consegue enviar e observar/confirmar mensagens reais

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave20`

Melhor momento para testar:
- testar logo aqui, porque qualquer problema de QR, descoberta ou ACK muda bastante o rumo do resto

O que testar:
- QR aparecer e permitir login
- reconnect apos restart
- descoberta de grupos e privados
- permissao por pessoa/grupo refletida em dados reais
- envio de mensagem de teste e reconciliacao de entrega

## Wave 21 - Pipeline conversacional e providers LLM reais

Objetivo:
- fechar o fluxo inbound -> contexto -> LLM -> reply -> envio

Entregaveis:
- wiring do inbound WhatsApp para `ConversationService`
- replies privados e em grupo ligados ao runtime real
- `llm-codex-oauth` real
- `llm-openai-compat` real
- `llm-orchestrator` a usar providers reais e catalogo de modelos
- integracao efetiva com `codex-auth-router`

Criterios de aceitacao:
- mensagens inbound reais passam pelo fluxo conversacional completo
- o assistente consegue responder segundo politica e contexto
- o roteamento de auth/modelo funciona sem hacks paralelos

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave21`

Melhor momento para testar:
- testar aqui e crucial, porque e o primeiro ponto em que o comportamento do bot fica realmente proximo do uso diario

O que testar:
- mensagem privada ao assistente
- mensagem em grupo com reply permitido
- follow-up contextual
- troca/control plane do provider LLM
- comportamento do `app owner` e regras de owner control

## Wave 22 - API operacional completa e weekly planner real

Objetivo:
- fechar o missing surface de API e o backend real dos fluxos de planeamento

Entregaveis:
- endpoints operacionais em falta para schedules, queue, logs, LLM e send
- `weekly-planner` do dominio com comportamento real
- integracao da UI de `Semana` com backend real
- diagnostics e views operacionais consumidas pela UI sem dependencias de demo

Criterios de aceitacao:
- os fluxos principais de operacao deixam de depender de dados mockados/demo
- `Semana` passa a usar backend real
- queue, logs e diagnostics ficam acessiveis pelo produto

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave22`

Melhor momento para testar:
- testar aqui um fluxo operacional completo, porque ja deves conseguir criar, rever e acompanhar trabalho real dentro da app

O que testar:
- criar e editar agendamentos
- preview e confirmacao de distribuicoes
- leitura de queue, diagnostics e logs
- fluxos principais da homepage sem fallback de demo

## Wave 23 - Hardening, cobertura e cutover para uso real

Objetivo:
- fechar a ronda com robustez suficiente para substituicao real do sistema antigo

Entregaveis:
- reforco forte de testes unitarios, integracao e e2e
- validacoes de restart, recover e resiliencia
- checklist de operacao real e cutover
- observabilidade minima suficiente para suporte operacional
- afinacao final de packaging/launcher/runtime para uso diario

Criterios de aceitacao:
- a app pode ser usada em `Live` como substituicao funcional do sistema anterior
- restart, reconnect e recuperacao nao deixam o operador cego
- existe cobertura minima para evitar regressao imediata nas areas criticas

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run test`
- `corepack pnpm run validate:wave23`

Melhor momento para testar:
- este e o melhor ponto para piloto serio ou cutover, porque aqui ja faz sentido perguntar se o produto substitui o fluxo antigo sem reservas operacionais grandes

O que testar:
- uso em `Live` durante uma sessao longa
- restart do backend e do host companion
- reconnect do WhatsApp
- fluxos completos de agendamento, distribuicao, conversa e permissao
- verificacao do launcher, da pagina web e dos sinais operacionais

## Fora de scope destas waves

- reintroduzir `alerts` e `automations` no workspace

Essas areas so devem voltar se houver necessidade real de produto, desenho novo e validacao propria.
