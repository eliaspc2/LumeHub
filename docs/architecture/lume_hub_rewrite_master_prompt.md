# Lume Hub Rewrite Master Prompt

Este ficheiro foi preparado para servir de prompt mestre e especificacao tecnica de reescrita.
O objetivo e permitir que uma LLM consiga reconstruir o projeto de raiz, com arquitetura modular, sem depender de adivinhar comportamentos importantes.

Usa este ficheiro como input principal para a reescrita.
Se a LLM tiver acesso ao codigo atual, deve usa-lo apenas para confirmar detalhes de compatibilidade; a arquitetura alvo descrita aqui e a referencia principal.

## Prompt Mestre

Tu es um engenheiro senior a reescrever de raiz o projeto `Lume Hub`, sucessor arquitetural do `WA-Notify`.
O sistema atual funciona como um backend local com integracao WhatsApp, motor de agendamentos, assistente LLM, fila de instrucoes, watchdog de entrega, automacoes, regras de alerta, UI local e uma camada de roteamento de `auth.json` OAuth do Codex.
O sistema novo deve assumir tambem, desde a raiz, as responsabilidades de integracao com o host: evitar deep sleep quando necessario, gerir persistencia de arranque no PC e gerir o mesmo ficheiro OAuth live usado pelo proprio Codex.

Quero que implementes este projeto de forma modular, testavel, resiliente e observavel.
Nao quero um `server.ts` gigante com toda a logica misturada.
Quero um programa composto por modulos independentes, cada um com responsabilidades claras, e um ficheiro bootstrap que os carrega e liga.

## Objetivo do produto

O sistema deve:

1. ligar-se ao WhatsApp Web via Baileys
2. normalizar mensagens recebidas e enviadas
3. suportar respostas conversacionais em chats privados e grupos
4. aceitar instrucoes em linguagem natural para criar, alterar, ativar, desativar e apagar agendamentos
5. suportar respostas simples de conversa quando o bot e chamado em grupos
6. manter uma fila de instrucoes para aplicar alteracoes estruturadas com seguranca
7. gerir eventos com numero variavel de alertas, incluindo defaults como `24h antes` e `30 min antes`
8. enviar mensagens agendadas sem duplicar nem marcar como enviadas cedo demais
9. detetar falhas e atrasos com um watchdog que avisa o owner
10. expor API HTTP e WebSocket para UI local
11. manter logs e audit trail suficientes para diagnostico
12. gerir varias contas Codex OAuth e escolher a menos pressionada
13. impedir que o PC entre em deep sleep quando o sistema precisa de ficar acordado
14. gerir o mesmo ficheiro OAuth live que o Codex usa, sem manter uma copia paralela escondida
15. instalar e manter a persistencia de arranque no proprio PC, com opcao configuravel na GUI

## Principios de arquitetura obrigatorios

1. O projeto deve ser organizado por modulos.
2. Cada modulo deve ter:
   - responsabilidade unica
   - interface publica explicita
   - dependencia injetada, nunca import circular
   - `start()` e `stop()` quando tiver ciclo de vida
3. Deve existir um bootstrap claro:
   - `src/main.ts`
   - `src/bootstrap/create_runtime.ts`
   - `src/bootstrap/module_loader.ts`
4. O bootstrap deve:
   - carregar configuracao
   - criar logger
   - criar storage
   - criar event bus
   - instanciar modulos
   - ligar dependencias
   - arrancar modulos pela ordem certa
5. O sistema deve ter uma unica fonte canonica de estado estruturado.
6. A LLM nunca deve ser a fonte de verdade do dominio; a LLM apenas propoe acoes estruturadas.
7. Regras de negocio devem viver em modulos de dominio, nao em handlers HTTP nem em callbacks de WhatsApp.
8. Mensagens enviadas devem ser tratadas com idempotencia e confirmacao.
9. O sistema deve ser desenhado para sobreviver a reinicios sem perder estado.
10. O sistema deve nascer como um agente modular, nao como um backend normal ao qual o comportamento de agente e acrescentado depois.
11. O sistema deve tratar a semana ISO como conceito de primeira classe no dominio de schedules.
12. O sistema deve ir buscar o OAuth Codex ao sitio canonico correto desde o primeiro dia.
13. Integracoes com o host nao sao acessorios; fazem parte do produto e devem existir no desenho inicial.

## Arquitetura alvo por modulos

### 1. `config`

Responsabilidade:
- carregar configuracao de env, ficheiros e defaults
- validar schema
- expor configuracao imutavel para o resto do sistema

Informacao que deve buscar:
- variaveis de ambiente
- ficheiros de configuracao em `data/` ou `config/`

Estado que nao deve guardar:
- nenhum estado de runtime

Forma ideal:
- um modulo `config` devolve um objeto typed
- toda a validacao e feita no arranque
- nenhuma leitura dispersa de `process.env` fora deste modulo

### 2. `logger` e `audit`

Responsabilidade:
- logging estruturado
- audit trail de operacoes
- registo de eventos relevantes

Informacao que deve buscar:
- eventos emitidos pelos modulos
- contexto do pedido HTTP
- contexto de mensagens WhatsApp

Forma ideal:
- logger estruturado por modulo
- audit log separado para eventos de negocio
- suportar `info`, `warn`, `error`, `debug`

### 3. `storage`

Responsabilidade:
- persistencia canonica do dominio
- migrations
- transacoes
- repositorios por agregado

Informacao que deve buscar:
- repositorio de ficheiros estruturados por grupo e por mes

Forma ideal:
- usar ficheiros por grupo como fonte canonica de estado dos schedules
- dentro de cada grupo, o calendario canonico deve ser organizado por mes
- a semana ISO continua obrigatoria como chave operacional dentro dos registos e projections
- a escrita deve ser atomica, com lock claro e sem fontes paralelas concorrentes
- estrutura minima esperada:
  - `data/groups/_settings.json`
  - `data/groups/120363407086801381@g.us/group.json`
  - `data/groups/120363407086801381@g.us/prompt.md`
  - `data/groups/120363407086801381@g.us/policy.json`
  - `data/groups/120363407086801381@g.us/calendar/2026-03.json`
  - `data/groups/120363407086801381@g.us/views/w13y2026.view.json`
  - `data/runtime/instruction-queue.json`
  - `data/runtime/watchdog.json`
- usar ficheiros separados apenas para:
  - auth Baileys
  - auth Codex OAuth
  - runtime auxiliar
  - assets estaticos
  - backups/exportacoes

O que nao repetir:
- nao ter `legacy` e storage nova concorrentes como fontes paralelas
- nao espalhar estado de negocio por muitos JSON ad hoc sem locking nem escrita atomica
- nao ter uma BD paralela a competir com os ficheiros por grupo como fonte de verdade

### 4. `event_bus`

Responsabilidade:
- desacoplar modulos
- propagar eventos internos

Eventos minimos:
- `wa.message.received`
- `wa.message.duplicate_ignored`
- `wa.outbound.observed`
- `wa.outbound.confirmed`
- `assistant.reply.generated`
- `schedule.event.upserted`
- `schedule.notification.upserted`
- `delivery.attempt.started`
- `delivery.attempt.confirmed`
- `delivery.attempt.failed`
- `instruction.enqueued`
- `instruction.action.done`
- `instruction.action.failed`
- `watchdog.issue.raised`
- `watchdog.issue.resolved`
- `codex_router.selection.changed`

Forma ideal:
- API pequena e typed
- sem logica de negocio no bus

### 5. `whatsapp_gateway`

Responsabilidade:
- ligar ao WhatsApp via Baileys
- manter sessao
- receber mensagens e normaliza-las
- enviar mensagens
- observar estados de entrega
- manter cache de metadata de grupos

Informacao que deve buscar:
- auth Baileys em disco
- eventos Baileys
- metadata de grupos do proprio WhatsApp

Informacao que deve produzir:
- mensagens normalizadas
- observacoes de outbound
- confirmacoes fortes de outbound

Regras obrigatorias:
- `sendMessage()` nunca conta como entrega
- so considerar confirmacao forte com sinais tipo `status >= SERVER_ACK`, `messages.update` ou `message-receipt.update`
- guardar tambem observacoes locais `append/notify` para heuristicas anti-duplicacao
- deduplicar inbound por:
  - `messageId`
  - fingerprint semantica curta para trafego dirigido ao bot

Forma ideal:
- o gateway nao decide politica de negocio
- o gateway so produz eventos e executa envio

### 6. `contacts_and_identity`

Responsabilidade:
- resolver identidade do remetente
- cruzar PN/LID/JIDs alternativos
- manter memoria de pessoas

Informacao que deve buscar:
- mensagens WhatsApp normalizadas
- repositorio de pessoas

Forma ideal:
- separar claramente:
  - identidade tecnica
  - nome amigavel
  - memoria importante

### 7. `group_directory`

Responsabilidade:
- mapear grupos por `jid`, `subject`, aliases e curso
- localizar o workspace de cada grupo

Informacao que deve buscar:
- cache do WhatsApp
- configuracao canonica dos cursos
- `data/groups/<jid>/`

Forma ideal:
- nunca depender apenas de `subject` livre como unica chave
- guardar:
  - `jid`
  - `preferredSubject`
  - aliases conhecidos
  - curso associado
  - caminho do workspace do grupo
  - caminho do `prompt.md`
  - caminho do `policy.json`
  - caminho do calendario do grupo

### 8. `discipline_catalog`

Responsabilidade:
- mapear codigos `UC` e `UFCD` para nome, curso e grupo destino

Informacao que deve buscar:
- idealmente de `config/discipline_catalog.json` ou tabela dedicada

Forma ideal:
- nao hardcoded no codigo
- permitir evolucao sem mexer em TypeScript

Catalogo atual relevante:
- curso `UFCD - Programacao`
  - jid: `120363402446203704@g.us`
  - subject preferido: `EFA Programador/a de Informatica`
- curso `UC - Ciberseguranca`
  - jid: `120363407086801381@g.us`
  - subject preferido: `CET Ciberseguranca`

### 9. `command_policy`

Responsabilidade:
- decidir se uma mensagem pode ou nao acionar capacidades do bot
- aplicar regras de owner, grupos autorizados e privados autorizados

Informacao que deve buscar:
- configuracao do modulo de comandos
- identidade do remetente
- contexto do chat

Forma ideal:
- politica declarativa
- regras separadas de logica conversacional

Capacidades a governar:
- scheduling
- conversa em grupo
- owner assistant
- owner terminal
- direct replies

### 10. `intent_classifier`

Responsabilidade:
- distinguir:
  - instrucoes operacionais
  - conversa casual
  - comandos do owner
  - pedidos de agenda
  - pedidos de resumo local

Informacao que deve buscar:
- texto normalizado
- contexto do chat
- tag/reply ao bot

Forma ideal:
- heuristica simples antes de chamar a LLM
- LLM so entra quando compensa

### 11. `assistant_context`

Responsabilidade:
- montar contexto para a LLM
- selecionar historico relevante
- injetar dados locais do dominio

Informacao que deve buscar:
- historico recente da conversa
- estado atual de agendamentos
- catalogo disciplinar
- memoria de pessoas quando fizer sentido
- timezone

Regra importante:
- mais contexto nao basta; e preciso relevancia
- dar peso maior as ultimas linhas e a ultima pergunta em aberto

Forma ideal:
- separar:
  - coletor de historico bruto
  - ranker de relevancia
  - resumidor opcional
  - montador final de prompt

### 12. `llm_service`

Responsabilidade:
- expor operacoes LLM do sistema
- `chat`
- `parse_schedules`
- `plan_weekly_prompts`
- `fix_or_apply_schedule_actions`

Informacao que deve buscar:
- `assistant_context`
- configuracao do provider
- codex auth router quando usar OAuth Codex

Forma ideal:
- providers pluggable
- separar:
  - construcao de prompt
  - chamada ao provider
  - parse estruturado
  - retry/fallback

Regras obrigatorias:
- logging de `providerUsed`, `mode`, preview e erro
- validacao forte de output estruturado
- fallback controlado quando o provider falha

### 13. `llm_provider_codex_oauth`

Responsabilidade:
- falar com `https://chatgpt.com/backend-api/codex/responses`
- listar modelos em `.../codex/models`
- tratar SSE de output

Informacao que deve buscar:
- `auth.json` selecionado
- `account_id`
- `client_version`

Forma ideal:
- isolado do dominio
- sem logica de negocio

### 14. `codex_auth_router`

Responsabilidade:
- gerir varios `auth.json` OAuth do Codex
- sincronizar replicas
- medir uso
- escolher a conta menos pressionada
- fazer switch canonico antes dos pedidos
- reagir a erros de quota/auth

Informacao que deve buscar:
- ficheiros `auth.json` candidatos
- endpoint de uso do Codex
- ficheiro de estado do router

Forma ideal:
- modulo proprio
- estados por conta
- score por conta
- cooldown
- switch manual e automatico

Regras obrigatorias:
- o ficheiro canonico live deve ser unico
- backups e replicas sao secundarios
- selection e report de sucesso/falha devem ser parte explicita do contrato

Origem correta do OAuth no ambiente atual:
- no host, o canonico live e:
  - `/home/eliaspc/.codex/auth.json`
- no runtime containerizado, isto aparece como:
  - `/codex/auth.json`
- fontes secundarias atualmente relevantes:
  - `/home/eliaspc/Cloud/GoogleDrive/auth.json`
  - `/home/eliaspc/.local/share/codex-auth-router/sources/secondary/auth.json`
- no runtime containerizado, estas aparecem como:
  - `/codex-cloud/auth.json`
  - `/codex-router/sources/secondary/auth.json`

Regra de implementacao:
- o projeto novo deve assumir explicitamente um `canonical oauth auth file`
- esse ficheiro e a fonte live para os pedidos
- esse ficheiro e o mesmo ficheiro live usado pelo CLI do Codex
- as restantes origens servem para:
  - descoberta
  - sincronizacao
  - backup
  - failover
- esta responsabilidade tem de existir no desenho inicial, nao como refactor futuro

### 14.a. `host_lifecycle`

Responsabilidade:
- instalar, atualizar e remover persistencia de arranque no proprio PC
- manter configuracao host-level do projeto
- aplicar decisoes de integracao com o host sem espalhar hacks pelo backend
- servir como companion local quando o core app estiver isolado em `LXD`

Informacao que deve buscar:
- `system settings` persistidas
- estado do companion local
- estado de arranque automatico configurado
- pedidos vindos da GUI e da API

Forma ideal:
- modulo proprio
- preferir `systemd --user` no Linux desktop para arranque automatico
- suportar `enable`, `disable`, `status`, `repair`
- se o core app estiver em container, este modulo deve viver num companion/app de host separado, mas pertencente ao mesmo projeto

Regras obrigatorias:
- a opcao de arrancar com o PC deve existir na GUI
- o estado deve sobreviver a reinicios
- a persistencia nao pode depender de um passo manual esquecido fora do projeto

### 14.b. `system_power`

Responsabilidade:
- evitar que o PC entre em deep sleep quando o sistema precisa de estar acordado
- adquirir e libertar `sleep inhibitor` de forma controlada
- expor politica configuravel pela GUI

Informacao que deve buscar:
- estado de sessao WhatsApp
- jobs pendentes/importantes
- estado do watchdog
- configuracao persistida do utilizador

Forma ideal:
- modulo proprio
- usar mecanismo standard do sistema operativo
- no Linux desktop, preferir integracao com `systemd/logind` ou mecanismo equivalente, em vez de hacks de polling

Regras obrigatorias:
- a politica de power deve ser persistente
- a GUI deve poder ativar/desativar esta responsabilidade
- o modulo nao deve manter o PC acordado sem criterio; deve usar politica explicita

### 15. `schedule_domain`

Responsabilidade:
- representar eventos reais e politicas de notificacao

Forma ideal:
- separar claramente:
  - `Event`
  - `ScheduleWeek`
  - `NotificationRule`
  - `NotificationJob`
  - `DeliveryAttempt`

Isto e critico.
No programa ideal, `pre30m` nao deve ser tratado como um "clone solto" do item base.
Deve existir:
- 1 evento base
- N regras de notificacao derivadas
- N jobs de envio materializados

Assim:
- apagar um job nao apaga o evento
- suprimir so o alerta principal nao mata o `pre30m`
- suprimir so o `pre30m` nao apaga o evento base

Regra adicional:
- todos os eventos e jobs devem pertencer explicitamente a uma `ISO week`
- `week_id` nao e apenas filtro de UI; e parte do modelo de dominio
- o sistema deve conseguir carregar, listar, exportar e operar por semana sem inferencias ad hoc

### 16. `schedule_policy_engine`

Responsabilidade:
- transformar um evento base em notificacoes derivadas
- aplicar regras de curso e tipo de evento

Informacao que deve buscar:
- evento base
- catalogo disciplinar
- regra por curso
- tipo de item

Regras atuais a preservar:
- o numero de avisos tem de ser variavel por evento
- o default do sistema deve ser:
  - 1 aviso relativo `24h antes`
  - 1 aviso relativo `30 min antes`
- o sistema deve permitir regras de horario fixo, por exemplo:
  - `1 dia antes as 20:00`
  - `no proprio dia as 17:00`
- o sistema deve continuar a suportar links/config por curso ou grupo

Forma ideal:
- regras declarativas
- implementacao pura
- sem side effects
- cada regra de notificacao deve suportar pelo menos:
  - `relative_before_event`
  - `fixed_local_time`

Exemplo de flexibilidade obrigatoria:
- um evento pode ter 0, 1, 2 ou N avisos
- um aviso pode ser `24h antes`
- outro aviso pode ser `30 min antes`
- outro aviso pode ser `no dia anterior as 20:00`

### 17. `schedule_repository`

Responsabilidade:
- guardar eventos base
- guardar regras de notificacao
- guardar jobs materializados
- expor queries por semana, curso, grupo, estado

Informacao que deve buscar:
- workspaces canonicos dos grupos

Forma ideal:
- usar ficheiros por grupo como fonte de verdade
- um ficheiro de calendario por mes dentro de cada grupo
- escolher mes em vez de quinzena:
  - porque `20-25` agendamentos por grupo continuam perfeitamente legiveis
  - porque a quinzena cria fronteiras artificiais
  - porque o mes encaixa melhor no modelo mental de calendario
- dentro do ficheiro mensal, cada evento e job continua a guardar `week_id`
- leitura/escrita sempre mediada por repositorio com lock e validacao de schema

Mas a organizacao por semana e obrigatoria:
- guardar `week_id` em `events`, `notification_rules` e `notification_jobs`
- expor APIs e queries por `week_id`
- permitir export/import por semana
- o `week_id` deve corresponder ao numero ISO oficial da semana
- a organizacao canonica em disco acontece por grupo e mes
- a vista semanal deve ser projection/indice operacional, nao a fronteira canonica do ficheiro

### 18. `schedule_dispatcher`

Responsabilidade:
- decidir quando um job esta elegivel para envio
- iniciar tentativa de entrega
- serializar ticks
- aplicar idempotencia

Informacao que deve buscar:
- jobs pendentes
- tempo atual
- estado de entrega anterior
- observacoes/confirmacoes outbound

Regras obrigatorias:
- nunca correr ticks concorrentes sobre o mesmo job
- nunca reenviar sem verificar estado do job e tentativas anteriores
- usar idempotency key por job
- distinguir:
  - `pending`
  - `waiting_confirmation`
  - `sent`
- o detalhe de falha deve viver em `lastError`, `attempts` e `watchdog issues`, sem introduzir uma floresta de estados visiveis
- quando o horario do evento passar, jobs ja concluidos devem ser removidos da semana ativa por politica de cleanup

### 19. `delivery_tracker`

Responsabilidade:
- reconciliar tentativas de envio com confirmacoes do WhatsApp
- resolver estados ambiguos
- manter historico de tentativas

Informacao que deve buscar:
- `wa.outbound.observed`
- `wa.outbound.confirmed`
- jobs de entrega

Forma ideal:
- modulo proprio
- sem logica dispersa pelo scheduler

Regras obrigatorias derivadas de bugs reais:
- nao marcar `sent` cedo demais
- nao reenviar so porque faltou confirmacao forte se ja houve observacao local do proprio outbound
- preferir nao duplicar mensagens visiveis
- passar de `pending` para `waiting_confirmation` assim que o envio e iniciado
- passar para `sent` apenas quando houver confirmacao suficiente

### 20. `instruction_queue`

Responsabilidade:
- receber acoes estruturadas
- persisti-las
- processa-las uma a uma
- reexecutar acoes pendentes/falhadas
- recuperar `running` stale apos reinicio

Informacao que deve buscar:
- pedidos da UI
- output estruturado da LLM
- repositorio de schedules

Forma ideal:
- a queue nao deve conter logica de negocio pesada
- a queue deve orquestrar application services

Tipos de acao atuais a preservar:
- `schedule_upsert`
- `schedule_delete`
- `schedule_enable`
- `schedule_disable`
- `llm_week_prompt`

### 21. `weekly_planner`

Responsabilidade:
- gerar prompts semanais ou planos semanais
- transformar texto livre em lote de acoes

Informacao que deve buscar:
- texto do utilizador
- semana alvo
- schedules atuais
- catalogo disciplinar

Forma ideal:
- modulo separado da conversa normal
- nas APIs e repositorios, a semana deve ser uma unidade formal de trabalho, nao so um texto no prompt

### 21b. `agent_runtime`

Responsabilidade:
- ser o nucleo do comportamento "agent"
- decidir quando responder localmente, quando chamar ferramentas, quando enfileirar acoes e quando apenas sugerir
- expor um conjunto de ferramentas internas ao agente desde a arquitetura base

Ferramentas internas minimas:
- `list_groups`
- `get_current_schedules`
- `get_week_schedule`
- `enqueue_schedule_actions`
- `query_people_memory`
- `read_watchdog_state`
- `read_instruction_queue`
- `send_whatsapp_text`
- `list_llm_models`
- `switch_codex_account`

Regra importante:
- o sistema nao deve ser "um backend de regras com um bocadinho de LLM"
- o sistema deve ser modelado desde o inicio como um agente com ferramentas, guardrails e dominio
- scheduling, conversa, planeamento semanal, diagnostico e correcao devem nascer dentro desta visao

Forma ideal:
- `conversation_engine` usa `agent_runtime`
- `llm_service` e so o motor de inferencia
- `agent_runtime` conhece:
  - ferramentas
  - politicas
  - contexto
  - limites operacionais

### 22. `conversation_engine`

Responsabilidade:
- decidir quando responder em grupos ou privados
- montar contexto
- chamar `llm_service.chat`
- enviar resposta com politica segura

Informacao que deve buscar:
- mensagem normalizada
- command policy
- historico
- memoria de pessoas
- schedules locais quando relevante

Regras atuais a preservar:
- em grupos o bot responde quando:
  - e taggado
  - ou quando lhe respondem
  - ou quando regras de resposta direta permitirem
- deve conseguir falar de agenda e tambem de temas gerais
- humor leve em grupos e permitido fora do tema cronograma
- follow-ups curtos devem manter o referente recente

### 23. `owner_control`

Responsabilidade:
- permitir comandos de terminal do owner
- devolver output controlado

Informacao que deve buscar:
- politica de owner
- texto da mensagem

Forma ideal:
- completamente isolado da conversa normal
- timeout e truncagem obrigatorios
- logs auditaveis

### 24. `alerts_engine`

Responsabilidade:
- regras simples de alerta por texto
- log ou webhook

Informacao que deve buscar:
- mensagens recebidas
- regras declarativas

Forma ideal:
- modulo pequeno e declarativo

### 25. `automations_engine`

Responsabilidade:
- lembretes programados simples por grupo
- acoes `log`, `webhook`, `wa_send`

Informacao que deve buscar:
- ficheiro de automacoes
- estado de disparos ja feitos
- group resolver

Forma ideal:
- se reescrever de raiz, preferir reusar o mesmo motor de jobs do scheduler em vez de um loop separado ad hoc

### 26. `delivery_watchdog`

Responsabilidade:
- detetar:
  - schedules em erro
  - schedules overdue
  - queue actions falhadas
- persistir issues
- avisar owner

Informacao que deve buscar:
- repositorio de jobs
- repositorio da queue
- owner targets

Forma ideal:
- o watchdog nao deve inferir negocio por scraping de ficheiros
- deve ler estado estruturado do repositorio semanal e do runtime
- deve conseguir levantar issue quando um job estiver mais de `x` minutos para alem de `sendAt` sem ter chegado a `sent`

### 27. `http_api`

Responsabilidade:
- expor interface de administracao local
- expor API de estado, configuracao, queue, schedules, LLM, WhatsApp

Rotas atuais importantes a preservar ou melhorar:
- `GET /api/status`
- `POST /api/admin/restart`
- `GET /api/qr`
- `GET /api/qr.svg`
- `GET /api/groups`
- `GET /api/assistant/catalog`
- `GET /api/automations`
- `GET /api/schedules`
- `GET /api/schedules/diagnostics`
- `PUT /api/schedules/settings`
- `POST /api/schedules`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`
- `POST /api/schedules/:id/enable`
- `POST /api/schedules/:id/disable`
- `GET /api/instruction-queue`
- `POST /api/instruction-queue/tick`
- `POST /api/instruction-queue/:id/retry`
- `GET /api/watchdog`
- `POST /api/watchdog/tick`
- `GET /api/commands/config`
- `PUT /api/commands/config`
- `GET /api/commands/logs`
- `GET /api/wa/messages`
- `GET /api/llm/config`
- `PUT /api/llm/config`
- `GET /api/llm/models`
- `GET /api/llm/logs`
- `GET /api/llm/codex-router`
- `POST /api/llm/codex-router/refresh`
- `POST /api/llm/codex-router/switch`
- `POST /api/llm/chat`
- `POST /api/llm/assistant`
- `POST /api/llm/schedules/parse`
- `POST /api/llm/schedules/apply`
- `POST /api/llm/schedules/fix`
- `POST /api/send`

Forma ideal:
- controllers finos
- application services por caso de uso
- validacao de input explicita

### 28. `ws_gateway`

Responsabilidade:
- notificar UI em tempo real

Eventos minimos:
- `qr`
- `status`
- `message`
- `alert`

### 29. `ui`

Responsabilidade:
- painel local de administracao
- chat assistente
- vista de schedules
- queue
- watchdog
- config

Forma ideal:
- UI separada do backend
- pode ser servida pelo mesmo processo, mas desacoplada

Objetivo explicito de UX:
- a pagina web nova deve ser significativamente menos confusa do que a atual
- a interface deve ser organizada pelo modelo mental do utilizador, nao pelo modelo interno dos ficheiros
- o utilizador nao deve ter de adivinhar:
  - qual e a semana ativa
  - qual e o estado real de um aviso
  - se um item e evento base ou lembrete derivado
  - de onde veio uma acao
  - se o bot respondeu, enfileirou, falhou ou ficou ambiguo

Arquitetura ideal da UI:
- shell principal com 3 zonas estaveis:
  - barra lateral de navegacao
  - area central da vista atual
  - painel contextual lateral opcional
- a pagina nao deve misturar no mesmo ecran principal:
  - chat assistente
  - lista completa de agendamentos
  - logs tecnicos
  - queue
  - watchdog
- esses elementos devem existir em vistas separadas, com ligacoes claras entre si

Navegacao principal recomendada:
- `Hoje`
- `Semana`
- `Calendario`
- `Assistente`
- `Fila`
- `Entregas`
- `Watchdog`
- `Grupos`
- `Configuracao`

Pagina inicial ideal: `Hoje`
- deve responder rapidamente a estas perguntas:
  - ha algo por enviar agora?
  - qual e a proxima aula/evento?
  - houve alguma falha hoje?
  - o WhatsApp esta ligado?
  - qual e a semana ativa?
- componentes recomendados:
  - cartao de estado geral
    - WhatsApp: `open/close/connecting`
    - LLM/provider/model
    - conta OAuth ativa
    - ultima sincronizacao
  - cartao `Proximos eventos`
  - cartao `Envios pendentes/agora`
  - cartao `Problemas ativos`
  - cartao `Atalhos`

Pagina `Semana`
- deve ser a principal vista operacional de planeamento
- deve mostrar claramente:
  - semana selecionada
  - eventos base
  - notificacoes derivadas
  - estado de cada entrega
- organizacao recomendada:
  - topo com seletor de semana
  - toggle:
    - `Eventos`
    - `Notificacoes`
    - `Tudo`
  - agrupamento por dia
  - cada cartao deve mostrar:
    - titulo humano
    - curso/grupo
    - `eventAt`
    - notificacoes derivadas
    - estado
    - ultima tentativa
    - link para detalhe

Regra de UX muito importante:
- nao mostrar `pre30m` como se fosse um agendamento independente e misterioso
- na UI, `pre30m` deve aparecer aninhado visualmente dentro do evento base
- o utilizador deve perceber:
  - evento base
  - alerta principal
  - lembrete `30m antes`
  - estado de cada um

Pagina `Calendario`
- vista mensal/semanal opcional
- foco visual em eventos base
- notificacoes derivadas aparecem apenas ao abrir detalhe ou ao ativar camada de entregas

Pagina `Assistente`
- deve ser limpa e focada na conversa
- nao deve partilhar o ecran principal com a grelha completa de agendamentos
- layout recomendado:
  - coluna principal de chat
  - painel lateral com contexto util:
    - semana ativa
    - grupo alvo atual
    - proximos eventos
    - ultimas acoes aplicadas
- cada resposta do assistente deve poder mostrar:
  - `so respondeu`
  - `enfileirou acoes`
  - `aplicou X alteracoes`
  - `falhou`
- quando o assistente produzir acoes, mostrar uma preview estruturada e legivel

Pagina `Fila`
- deve mostrar instrucoes e acoes como pipeline operacional
- nao apenas JSON ou lista crua
- colunas recomendadas:
  - `instructionId`
  - origem
  - resumo
  - semana
  - estado
  - numero de acoes
  - ultima atualizacao
- ao abrir detalhe:
  - mostrar acoes internas da instrucao
  - `pending/running/done/failed`
  - erros
  - retries

Pagina `Entregas`
- pagina dedicada a delivery
- objetivo:
  - explicar porque uma mensagem foi enviada, repetida, confirmada tarde ou ficou ambigua
- cada job deve mostrar:
  - `job id`
  - evento pai
  - tipo de notificacao
  - alvo
  - tentativas
  - observacao local
  - confirmacao forte
  - estado final
- isto e essencial para diagnostico e para evitar que a UI esconda as causas reais

Pagina `Watchdog`
- deve ser um inbox de problemas reais
- separar claramente:
  - ativos
  - resolvidos
- cada issue deve mostrar:
  - tipo
  - referencia
  - semana
  - mensagem curta
  - first seen
  - last seen
  - resolved at
- deve existir CTA claro:
  - `abrir evento`
  - `abrir job`
  - `abrir instrucao`

Pagina `Grupos`
- deve mostrar:
  - grupos conhecidos
  - subject preferido
  - jid
  - aliases
  - curso associado
  - ultimo refresh

Pagina `Configuracao`
- separar por tabs:
  - `WhatsApp`
  - `LLM`
  - `OAuth Router`
  - `Comandos`
  - `Politicas`
  - `Sistema`
- nao misturar tudo num formulario unico

Principios de apresentacao obrigatorios:
- sempre mostrar a semana ativa no topo quando a vista depende de semana
- sempre mostrar timezone visivel
- sempre distinguir:
  - `evento`
  - `notificacao`
  - `tentativa`
  - `problema`
- usar badges consistentes:
  - `pending`
  - `waiting_confirmation`
  - `sent`
  - `disabled`
  - `issue`
- usar linguagem humana na UI e linguagem tecnica apenas no detalhe

Hierarquia de detalhe recomendada:
- lista resumida
- drawer ou painel lateral de detalhe
- pagina completa so quando o objeto e complexo

Pesquisa e filtros obrigatorios:
- por semana
- por grupo
- por disciplina
- por estado
- por tipo:
  - evento
  - notificacao
  - queue action
  - issue watchdog

Estados vazios obrigatorios:
- sem eventos na semana
- sem problemas ativos
- sem fila pendente
- WhatsApp desligado
- QR por autenticar

Estados de erro obrigatorios:
- erro de conexao WA
- erro de provider LLM
- erro de auth OAuth
- erro de persistencia
- erro de queue

Componentes frontend recomendados:
- `AppShell`
- `TopBar`
- `WeekSwitcher`
- `StatusSummaryCard`
- `EventCard`
- `NotificationList`
- `DeliveryAttemptsPanel`
- `InstructionQueueTable`
- `WatchdogInbox`
- `AssistantChatPanel`
- `ContextSidebar`
- `GroupDirectoryTable`
- `ConfigTabs`

Modelo mental da UI ideal:
- o utilizador trabalha sobretudo sobre:
  - semanas
  - eventos
  - notificacoes
  - conversas
  - problemas
- nao trabalha sobre:
  - ficheiros JSON
  - nomes internos de modulos
  - logs crus

Regra final de UX:
- qualquer acao visivel no sistema deve responder a:
  - o que e isto?
  - porque existe?
  - qual e o estado?
  - qual foi a ultima tentativa?
  - onde posso corrigir?

### 30. `operations`

Responsabilidade:
- arranque
- shutdown
- health
- service integration
- backups

Forma ideal:
- readiness e liveness claros
- graceful shutdown
- hooks de restart
- capacidade de arrancar em modo core app e em modo host companion

## Fontes ideais de informacao por responsabilidade

### Fonte canonica estruturada

Idealmente usar:
- `data/groups/_settings.json`
- `data/groups/120363407086801381@g.us/group.json`
- `data/groups/120363407086801381@g.us/prompt.md`
- `data/groups/120363407086801381@g.us/policy.json`
- `data/groups/120363407086801381@g.us/calendar/2026-03.json`
- `data/groups/120363407086801381@g.us/views/w13y2026.view.json`
- `data/runtime/instruction-queue.json`
- `data/runtime/watchdog.json`
- `data/runtime/codex-auth-router.state.json`
- `data/runtime/host-state.json`

Modelo minimo do ficheiro mensal por grupo:
- `schemaVersion`
- `groupJid`
- `groupLabel`
- `year`
- `month`
- `timezone`
- `events[]`

Cada `event` deve conter pelo menos:
- `eventId`
- `weekId`
- `groupJid`
- `groupLabel`
- `eventAt`
- `notifications[]`

Cada `notification` deve conter pelo menos:
- `jobId`
- `weekId`
- `ruleType`
- `sendAt`
- `status`
- `attempts`
- `lastError`
- `lastOutboundObservationAt`
- `confirmedAt`

### Ficheiros que devem continuar fora da DB

- `Baileys auth` em diretoria propria
- `Codex auth.json` canonico live e backups
- `discipline_catalog.json`
- manifestos/service units do host companion quando gerados
- `commands.config.json` ou tabela equivalente
- assets da UI

### Onde cada modulo vai buscar a informacao

- `whatsapp_gateway`
  - Baileys auth
  - eventos da socket
- `group_directory`
  - metadata do WhatsApp
  - catalogo de cursos
- `discipline_catalog`
  - ficheiro declarativo ou tabela
- `people_memory`
  - DB `people`, `people_notes`
- `command_policy`
  - configuracao administrativa
- `assistant_context`
  - DB de mensagens
  - DB de schedules
  - catalogo disciplinar
  - memoria de pessoas
- `llm_service`
  - provider config
  - `assistant_context`
- `schedule_policy_engine`
  - evento base
  - regra por curso
- `schedule_dispatcher`
  - DB de jobs pendentes
  - tempo atual
  - delivery tracker
- `delivery_tracker`
  - eventos outbound do WhatsApp
  - DB de attempts/jobs
- `instruction_queue`
  - DB de queue
  - application services
- `watchdog`
  - DB de jobs
  - DB da queue
  - owner targets
- `codex_auth_router`
  - ficheiros auth
  - endpoint de usage
  - estado persistido do router

## Requisitos adicionais de desenho que nao sao opcionais

### A. OAuth correto desde o arranque

O projeto novo deve nascer ja com:

1. modulo `codex_auth_router`
2. conceito de `canonical auth file`
3. sincronizacao de fontes secundarias
4. score por conta
5. switch manual e automatico

Nao aceites um desenho em que isto fique para "fase 2".

### B. Semana como agregado real

O projeto novo deve nascer ja com:

1. `week_id` como campo formal, mesmo que os ficheiros canonicos sejam mensais por grupo
2. queries por semana
3. planner semanal
4. export/import por semana
5. UI e API conscientes da semana

Nao aceites um desenho em que a organizacao semanal seja apenas um ficheiro legado ou um naming convention.

### C. Agente desde a fundacao

O projeto novo deve nascer ja com:

1. `agent_runtime`
2. `tool registry`
3. `conversation_engine` em cima desse runtime
4. `llm_service` separado do dominio
5. guardrails e politicas no runtime de agente

Nao aceites um desenho em que o sistema seja primeiro um CRUD e so depois "ganhe agent".

## Estrutura ideal de pastas

```text
src/
  main.ts
  bootstrap/
    create_runtime.ts
    module_loader.ts
    dependency_container.ts
  config/
    load_config.ts
    schema.ts
  core/
    logger/
    events/
    clock/
    ids/
    errors/
  infrastructure/
    db/
      sqlite.ts
      migrations/
    http/
      create_http_server.ts
      routes/
    ws/
      ws_gateway.ts
    whatsapp/
      baileys_client.ts
      message_normalizer.ts
      outbound_tracker.ts
      group_cache.ts
    llm/
      provider_registry.ts
      codex_oauth_provider.ts
      openai_compat_provider.ts
    auth/
      codex_auth_router.ts
  modules/
    agent_runtime/
    group_directory/
    discipline_catalog/
    people_memory/
    command_policy/
    intent_classifier/
    assistant_context/
    conversation/
    owner_control/
    schedules/
      events/
      notification_rules/
      notification_jobs/
      schedule_policy_engine.ts
      schedule_repository.ts
      schedule_dispatcher.ts
      delivery_tracker.ts
    instruction_queue/
    watchdog/
    alerts/
    automations/
    observability/
  application/
    use_cases/
      send_message.ts
      parse_schedule_text.ts
      apply_schedule_actions.ts
      enqueue_instruction.ts
      retry_instruction.ts
      list_models.ts
      switch_codex_account.ts
  api_contracts/
    dto/
    validators/
  ui/
    ...
  tests/
    unit/
    integration/
    end_to_end/
```

## Bootstrap ideal

Implementa um bootstrap com este papel:

1. carregar `config`
2. criar `logger`
3. criar `db`
4. correr migrations
5. criar `event_bus`
6. criar modulos de infraestrutura
7. criar modulos de dominio
8. criar application services
9. montar API HTTP e WS
10. arrancar:
   - codex auth router
   - whatsapp gateway
   - schedule dispatcher
   - instruction queue worker
   - watchdog
   - automations
   - http server

Pseudo-estrutura:

```ts
const runtime = await createRuntime();
await runtime.start();
```

E dentro de `createRuntime()`:

```ts
const config = loadConfig();
const logger = createLogger(config);
const weeklyStorage = await createWeeklyStorage(config);
const runtimeState = await createRuntimeStateStore(config);
const bus = createEventBus();

const infra = createInfrastructure({ config, logger, weeklyStorage, runtimeState, bus });
const modules = createModules({ config, logger, weeklyStorage, runtimeState, bus, infra });
const app = createHttpAndWsApp({ config, logger, modules, infra });

return {
  start: async () => {
    await infra.codexAuthRouter.start();
    await infra.whatsApp.start();
    await modules.scheduleDispatcher.start();
    await modules.instructionQueue.start();
    await modules.watchdog.start();
    await modules.automations.start();
    await app.start();
  },
  stop: async () => { ... }
};
```

## Regras de implementacao aprendidas com bugs reais

Estas regras sao obrigatorias porque o sistema atual falhou nelas:

1. Nao tratar `sock.sendMessage()` como sucesso final.
2. Nao marcar `sent` apenas por eco local do Web.
3. Guardar confirmacao forte separada de observacao local.
4. Quando houver observacao local mas faltar ACK forte, preferir evitar duplicacao de mensagens visiveis.
5. Dedupe de inbound por `messageId` e fingerprint curta.
6. Serializar o tick do scheduler.
7. Nao permitir que o mesmo job seja reenviado por reentrancia.
8. Nao ter duas fontes de verdade para schedules.
9. Nao modelar `pre30m` como simples clone sem relacao formal com o evento base.
10. Nao apagar o evento base so para parar um dos lembretes.
11. O watchdog nao deve acusar overdue enquanto um job estiver legitimamente em `waiting_confirmation` dentro da sua janela de confirmacao.
12. O contexto de conversa deve dar mais peso a mensagens recentes e ao ultimo referente em aberto.
13. O catalogo disciplinar nao deve ficar enterrado em codigo.
14. O roteamento de contas Codex deve ser modular e auditavel.

## Compatibilidade funcional minima a manter

1. WhatsApp via QR login.
2. API local HTTP na porta configuravel.
3. WebSocket para eventos em tempo real.
4. Config por env + ficheiro.
5. Suporte para:
   - mensagens privadas autorizadas
   - grupos autorizados
   - owner mode
   - owner terminal opcional
6. Parsing de agendamentos por linguagem natural.
7. Respostas conversacionais com historico.
8. Politicas de `EFA`, `CET`, `AS` e `pre30m`.
9. Queue de instrucoes com retry.
10. Watchdog com aviso ao owner.
11. Logs de:
   - mensagens WA
   - interacoes de comandos
   - runs LLM
12. Codex OAuth router com switch manual e automatico.

## Casos de teste obrigatorios

Implementa testes para pelo menos estes cenarios:

1. inbound duplicado com o mesmo `messageId` nao dispara duas respostas
2. inbound duplicado semanticamente com `quote + text` nao dispara duas respostas
3. `sendMessage()` sem ACK forte nao marca job como `sent`
4. observacao local + falta de ACK forte nao gera spam duplicado
5. tick do scheduler nao reentra sobre o mesmo job
6. apagar um alerta derivado nao apaga o evento base
7. suprimir o alerta principal nao deve apagar automaticamente o `pre30m`, a menos que a politica assim o diga explicitamente
8. `watchdog` ignora jobs em `waiting_confirmation` dentro da grace window configurada
9. follow-up conversacional tipo `E a de hoje?` preserva referente recente
10. pedido de horario em outro fuso responde com Lisboa + fuso pedido
11. account router troca de conta em erro de quota
12. account router escolhe a conta com melhor score

## Escolhas tecnicas recomendadas

- linguagem: TypeScript
- runtime: Node 20+
- HTTP: Express ou Fastify
- WS: ws ou equivalente
- WhatsApp: Baileys
- storage canonico: pastas por grupo com calendario mensal
- validacao: Zod ou equivalente
- logging: pino ou equivalente
- testes: Vitest ou Jest

## O que nao fazer

1. Nao criar um monolito sem modulos.
2. Nao concentrar regra de negocio no handler HTTP.
3. Nao espalhar `process.env` pelo codigo inteiro.
4. Nao usar JSON solto sem schema, locking e repositorio disciplinado.
5. Nao usar polling e retries agressivos que gerem spam.
6. Nao acoplar a UI ao backend por detalhes internos.
7. Nao fazer a LLM aplicar diretamente alteracoes sem validacao de dominio.

## Plano de implementacao esperado

A LLM que executar esta reescrita deve seguir esta ordem:

1. criar estrutura do projeto e bootstrap
2. criar config, logger, repositorio semanal, runtime files e event bus
3. criar codex auth router e fonte canonica OAuth
4. criar whatsapp gateway e normalizacao
5. criar repositorios de dominio com `week_id` e ficheiros canonicos por grupo/mes
6. criar schedule domain, schedule weeks e dispatcher
7. criar delivery tracker
8. criar instruction queue
9. criar watchdog
10. criar llm service e providers
11. criar `agent_runtime`, tool registry e conversation engine
12. criar command policy e intent classifier
13. criar API HTTP e WS
14. criar UI
15. criar testes
16. documentar operacao

## Output esperado da LLM que executar este prompt

A LLM deve entregar:

1. codigo completo do projeto
2. migrations
3. ficheiros de configuracao exemplo
4. testes
5. README de arranque
6. documento de arquitetura
7. notas de migracao a partir do sistema atual

## Pedido final

Reescreve o projeto `Lume Hub` de raiz seguindo exatamente esta arquitetura modular.
Quero um sistema mais limpo, mais previsivel e mais resistente do que o atual.
Trata esta especificacao como contrato funcional e arquitetural.
Se alguma decisao nao estiver explicitamente definida aqui, escolhe a opcao que:

1. reduz acoplamento
2. aumenta observabilidade
3. preserva idempotencia
4. evita duplicacao de mensagens
5. protege a fonte canonica de estado
