# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 49` ja foram executadas e validadas.
O runtime `Live` atual continua funcional e a ronda de inteligencia por grupo ficou fechada com storage canonico, retrieval isolado, UI/API operacional, uso live auditavel e limpeza final.

O storage canonico da ronda de media ja ficou aberto com:

- `data/runtime/media/assets/<assetId>/binary`
- `data/runtime/media/assets/<assetId>/metadata.json`
- `data/runtime/media/library.json`

O inbound live de media tambem ja ficou fechado com:

- deteccao de `video`, `image`, `document` e `audio` no adapter WhatsApp
- ingest automatica para a biblioteca operacional
- API para listar assets e consultar metadata
- pagina `/media` no frontend live
- distribuicao multi-grupo de media por `assetId` na `instruction-queue`
- retry apenas dos alvos falhados
- auditoria por alvo na queue

O fluxo guiado desta ronda tambem ja ficou aberto com:

- escolha direta do video recebido na pagina `Media`
- selecao explicita de grupos com master switch e switches por grupo
- `dry_run` e envio `confirmed` a partir da mesma pagina
- visao recente de entrega por grupo sem sair do fluxo

A ronda do agente de projeto tambem ja ficou fechada com:

- pagina `/workspace` no frontend
- modulo `workspace-agent` no backend
- API live para pesquisar ficheiros, ler preview e correr runs do agente
- execucao real via `codex exec` limitada ao repo do `LumeHub`
- historico recente de runs e ficheiros alterados
- diff por ficheiro e contexto guiado antes de `apply`
- aprovacao explicita, bloqueio de concorrencia e auditoria visivel
- limpeza final de docs, naming e validadores da serie

## Estado do plano

As `Wave 35` a `Wave 42` ja foram executadas e validadas.
A ronda de simplificacao do GUI ficou fechada com shell minima, paginas principais mais curtas, configuracao avancada sob demanda e limpeza final dos validadores e do copy de transicao.
A `Wave 40` tambem ja fechou diffs por ficheiro, resumo estruturado de contexto e revisao guiada de ficheiro na pagina `Projeto`.
A `Wave 41` ja fechou aprovacao explicita para `apply`, bloqueio de concorrencia, auditoria visivel do pedido/modo/resultado e guardrails operacionais no backend e na UI.
A `Wave 42` fechou a limpeza final da ronda do agente de projeto, consolidando validadores, removendo copy provisoria e alinhando docs ao estado final da pagina `Projeto`.
A `Wave 43` fechou a LLM live por defeito, com provider real ativo quando a auth existe e fallback deterministico visivel e auditavel quando a auth falha.
A `Wave 44` fechou o scheduling live com `preview -> apply -> queue -> auditoria`, incluindo alteracao real do calendario por assistente e diff funcional visivel antes e depois do `apply`.
A `Wave 45` fechou o importador idempotente de schedules do `WA-notify`, com pagina operacional em `Configuracao`, relatorio de itens importados/ambiguos e migracao real para o storage mensal canonico por grupo.
A `Wave 46` fechou `alerts` e `automations` dentro da arquitetura nova, com import minimo de `alerts.json` e `automations.json`, execucao live, auditoria e pagina operacional em `Configuracao`.
A `Wave 47` fechou a suite verde e o hardening de restart/cutover, com `pnpm run test` a passar por completo e cobertura atualizada para o copy live mais recente.
A `Wave 48` fechou o shadow mode com dados reais:
- snapshot live de readiness em `Configuracao`
- checklist de shadow mode e de cutover
- comparacao curta `WA-notify` vs `LumeHub`
- validacao consolidada agora em `validate:wave49`

A `Wave 49` fechou a limpeza final da ronda:
- consolidacao da serie em `validate:wave49`
- remocao dos validadores intermédios `43..48`
- docs e backlog alinhados ao estado final da ronda

## Estado do plano

A ronda de paridade e migracao face ao `WA-notify` ficou fechada do ponto de vista de implementacao.
A `Wave 51` continua ativa como limpeza final curta dessa ronda.

Foi agora aberta uma nova ronda maior para reposicionar o produto em torno de:

- experiencia `group-first`
- calendario semanal de notificacoes como vista principal
- pagina propria por grupo com switcher explicito
- modos de grupo `com_agendamento` e `distribuicao_apenas`
- ownership real por grupo
- politica explicita sobre quem pode ou nao tagar o bot
- separacao clara entre configuracao `WhatsApp`, configuracao `LumeHub` e chat direto com a LLM

## Waves ativas

### Wave 51 - Limpeza final da ronda de operacao de migracao

Objetivo:
- remover copy e validadores obsoletos da ronda
- deixar docs e scripts alinhados ao estado final

Entregaveis esperados:
- `validate:wave51`
- docs, README e backlog alinhados
- limpeza de lixo tecnico/documental criado pela `Wave 50`

Contexto atual:
- a `Wave 50` ja deixou pronta a pagina `Migracao`
- o shadow mode deixou de depender de `Configuracao avancada`
- o `codex auto router` ja tem GUI live para preparar a melhor conta e fazer switch manual

## Nova ronda ativa

Foi aberta uma nova ronda para reorientar o frontend e a operacao diaria do produto.
O objetivo desta serie ja nao e apenas "mostrar modulos"; passa a ser tornar o `LumeHub` numa experiencia operacional centrada em grupos e em notificacoes semanais.

Regra desta ronda:

- manter storage canonico mensal por grupo e `week_id` ISO no backend
- a UI operacional principal passa a ser semanal
- switches globais deixam de dominar a shell e passam a viver em paginas de configuracao dedicadas
- cada grupo passa a ser uma unidade operacional explicita, com modo, owner e politicas locais

Primeiros pontos em que vale a pena o utilizador testar:

- no fim da `Wave 53`, para validar shell, navegacao e a direcao `group-first`
- no fim da `Wave 55`, para validar se o calendario semanal representa a operacao certa
- no fim da `Wave 57`, para validar se ownership e politicas de grupo batem certo com o workflow real

### Wave 52 - Fundacao do modelo `group-first`

Objetivo:
- fechar contratos, naming e copy canonicos para o novo modelo operacional antes de mexer pesado na UI

Entregaveis esperados:
- modelo canonico de `group mode`:
  - `com_agendamento`
  - `distribuicao_apenas`
- metadata por grupo para:
  - owner do grupo
  - estado de scheduling
  - politica de tag ao bot
  - permissao de usar LLM para scheduling
- contratos backend/frontend alinhados para:
  - paginas por grupo
  - switcher de grupo
  - calendario semanal de notificacoes
  - paginas separadas `WhatsApp`, `LumeHub` e `LLM`
- docs e seeds minimos atualizados sem quebrar o runtime atual

Validacao esperada:
- `validate:wave52`
- smoke de arranque sem regressao de runtime

Vale a pena o utilizador testar aqui?
- nao; esta wave prepara o terreno e fecha o modelo antes da UX visivel

### Wave 53 - Shell `group-first` e navegacao nova

Objetivo:
- trocar a shell atual por uma navegacao mais curta e centrada em grupos

Entregaveis esperados:
- nova navegacao principal com entradas curtas e estaveis:
  - `Calendario`
  - `Grupos`
  - `WhatsApp`
  - `LumeHub`
  - `LLM`
  - `Migracao` continua acessivel, mas deixa de contaminar o fluxo principal
- switcher de grupo global visivel
- rota base de grupo tipo `/groups/:groupJid`
- shell limpa sem excesso de copy tecnico nem mistura de settings globais no workspace operacional

Validacao esperada:
- `validate:wave53`
- browser headless nas rotas novas sem ecra branco

Vale a pena o utilizador testar aqui?
- sim; aqui vale a pena validar a direcao visual e a navegacao antes de aprofundar features

### Wave 54 - Pagina de grupo e configuracao operacional por grupo

Objetivo:
- dar a cada grupo uma pagina propria e uma configuracao clara

Entregaveis esperados:
- pagina de grupo com resumo operacional, owner, modo do grupo e politicas locais
- dropdown na propria pagina para trocar rapidamente de grupo
- area de configuracao do grupo com:
  - owner do grupo
  - grupo com ou sem agendamento
  - permitir ou bloquear tag ao bot por membros
  - switches locais relevantes
- esconder detalhes tecnicos secundarios atras de modo avancado

Validacao esperada:
- `validate:wave54`
- smoke da pagina de grupo com troca de grupo e persistencia de settings

Vale a pena o utilizador testar aqui?
- sim; aqui valida-se se o workspace por grupo faz sentido na operacao real

### Wave 55 - Calendario semanal de notificacoes

Objetivo:
- fazer do calendario semanal de notificacoes a vista principal de operacao

Entregaveis esperados:
- vista semanal canonica para notificacoes por grupo
- leitura clara de:
  - `pending`
  - `waiting_confirmation`
  - `sent`
- criacao, edicao e desativacao de notificacoes no proprio calendario semanal
- traducao da storage mensal canonica para projection semanal sem mudar a fronteira de persistencia

Validacao esperada:
- `validate:wave55`
- browser headless da pagina semanal
- smoke de criar, editar e desativar notificacao

Vale a pena o utilizador testar aqui?
- sim; este e o checkpoint principal para validar se a UX semanal esta certa

### Wave 56 - Modos do grupo e roteamento `agendamento` vs `distribuicao`

Objetivo:
- tornar explicito o comportamento do produto conforme o modo de cada grupo

Entregaveis esperados:
- quando o grupo esta `com_agendamento`:
  - pedidos relevantes passam pela LLM e podem originar `preview/apply` de scheduling
- quando o grupo esta `distribuicao_apenas`:
  - nao ha scheduling local para esse grupo
  - mensagens pessoais elegiveis entram apenas em fan-out/distribuicao
- regras de UI e backend coerentes com o modo atual do grupo
- copy clara para o utilizador perceber o que o bot faz em cada modo

Validacao esperada:
- `validate:wave56`
- testes de integracao para ambos os modos

Vale a pena o utilizador testar aqui?
- sim; aqui da para corrigir cedo a semantica do produto antes das permissoes finas

### Wave 57 - Ownership por grupo e politica de interacao com o bot

Objetivo:
- dar poderes reais ao owner do grupo e fechar as ACL de interacao

Entregaveis esperados:
- owner do grupo pode usar a LLM para scheduling no(s) grupo(s) que possui
- politica explicita sobre quem pode tagar o bot em grupos
- alinhamento entre `app owner`, `group owner` e membros normais
- UI e auditoria que mostrem permissao efetiva sem linguagem tecnica excessiva

Validacao esperada:
- `validate:wave57`
- testes de integracao de permissao
- smoke de comportamento em grupo para owner vs nao owner

Vale a pena o utilizador testar aqui?
- sim; este e o checkpoint certo para validar se ownership e politicas batem com o workflow humano real

### Wave 58 - Separacao de `WhatsApp` e `LumeHub` Settings

Objetivo:
- separar claramente configuracao de canal de configuracao do produto

Entregaveis esperados:
- pagina `WhatsApp` focada em sessao, auth, grupos, conversas e diagnostico do canal
- pagina `LumeHub` focada em settings globais, defaults, host companion e comportamento do produto
- mover switches globais para estas paginas e tirar esse peso do workspace diario
- manter a pagina `Migracao` como area propria, sem contaminar as settings base

Validacao esperada:
- `validate:wave58`
- browser headless nas paginas `WhatsApp`, `LumeHub` e `Migracao`

Vale a pena o utilizador testar aqui?
- opcional; aqui o foco e consolidacao da IA de produto nas settings

### Wave 59 - Pagina de chat direto com a LLM

Objetivo:
- abrir uma pagina propria para interagir diretamente com a LLM sem depender do fluxo de grupo

Entregaveis esperados:
- pagina `LLM` com chat direto e contexto claro
- possibilidade de escolher escopo:
  - global
  - grupo atual
- visibilidade de quando a conversa e so chat e quando pode preparar acoes
- integracao segura com `preview/apply` quando fizer sentido

Validacao esperada:
- `validate:wave59`
- smoke de chat direto com LLM e selecao de contexto

Vale a pena o utilizador testar aqui?
- sim; aqui valida-se se a pagina direta com a LLM e util sem confundir o utilizador

### Wave 60 - Limpeza final da ronda `group-first`

Objetivo:
- fechar a ronda sem lixo tecnico nem copy herdado da shell anterior

Entregaveis esperados:
- `validate:wave60`
- docs, README e backlog alinhados ao novo fluxo
- remocao de copy obsoleto, rotas provisórias, seeds/demo desatualizados e validadores intermédios

Contexto esperado no fecho:
- calendario semanal como vista operacional principal
- paginas por grupo como unidade de configuracao e trabalho
- modos `com_agendamento` e `distribuicao_apenas` fechados
- `WhatsApp`, `LumeHub` e `LLM` como areas separadas e claras

## Como reabrir uma ronda

Antes de abrir uma wave nova, ler:

1. `/home/eliaspc/Documentos/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/lume-hub/README.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro
6. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md`

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
- se for aberta uma nova ronda:
  - reservar desde logo a ultima wave dessa ronda para limpeza final
  - essa wave deve remover lixo tecnico e documental criado ou tornado obsoleto pela propria ronda

Rebuild minimo esperado:

- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se tocar backend, HTTP, WS ou runtime:

- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada

## Fora de scope por defeito

- abrir rondas novas sem bloqueador real validado
- reintroduzir stubs ou backlog falso para areas ja fechadas
