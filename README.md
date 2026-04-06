# Lume Hub

Base do projeto `Lume Hub`, desenhado para reescrever o `WA-Notify` atual de raiz com arquitetura modular, orientada a objetos, portavel e preparada para runtime isolado.
O layout foi pensado primeiro para `LXD`, mas continua valido se mais tarde o runtime passar para `Incus` ou equivalente.

## Objetivo

Este projeto nasce com quatro separacoes claras:

1. `source/`
   - codigo-fonte canonico do projeto novo
   - aqui e onde a implementacao deve acontecer
2. `runtime/`
   - estrutura operacional para correr o sistema fora do codigo-fonte
   - neste momento esta preparada para `LXD`, sem instalar nada automaticamente
3. `docs/`
   - arquitetura alvo, regras de implementacao, reaproveitamento e plano de deploy
4. `legacy_healthy_code/`
   - referencia residual minima do sistema antigo
   - neste momento restam apenas `reference_engines/` para comportamentos ainda nao reintroduzidos de forma real

## Responsabilidades nao opcionais do produto

O projeto novo deve assumir explicitamente estas responsabilidades:

1. impedir deep sleep do PC quando o sistema precisa de continuar acordado
2. gerir o mesmo ficheiro OAuth live usado pelo Codex
3. instalar e manter persistencia de arranque no proprio PC
4. suportar numero variavel de avisos por evento
5. usar pastas por grupo como fonte canonica dos schedules
6. escalar de poucos grupos para muitos grupos sem pressupor um conjunto pequeno fixo
7. suportar distribuicao fan-out de uma mensagem para `N` grupos a partir de regras por pessoa/remetente

Isto nao fica "fora do projeto".
Fica modelado em modulos e deployables proprios.

## Dois deployables previstos

O desenho ideal passa a assumir dois programas do mesmo projeto:

1. `lume-hub-backend`
   - core app
   - pode correr em `LXD`
2. `lume-hub-host`
   - companion local no proprio PC
   - trata energia, arranque persistente e ownership do ficheiro OAuth live do Codex

## Regra principal

O codigo novo deve ser escrito em `source/`.
O runtime em `runtime/` deve ser tratado como destino de build/publicacao, nao como lugar para desenvolver manualmente.

## Decisoes de scheduling ja fechadas

- os avisos por evento sao variaveis
- o default do sistema deve ser:
  - `24h antes`
  - `30 min antes`
- cada aviso pode ser:
  - relativo ao evento
  - ou por horario fixo
- os estados visiveis do envio devem ser:
  - `pending`
  - `waiting_confirmation`
  - `sent`
- quando a hora do evento passar, jobs concluidos devem ser limpos da semana ativa
- o cleanup deve arquivar eventos passados concluidos antes de os retirar da vista ativa
- um evento passado so sai da vista ativa quando todos os jobs estiverem concluidos, suprimidos ou desativados
- a organizacao canonica dos schedules deve ser por grupo
- dentro de cada grupo, o calendario canonico deve ser mensal
- a semana ISO continua obrigatoria como indice operacional
- a quinzena nao foi escolhida como fronteira canonica
- o watchdog deve detetar jobs que passaram `x` minutos da hora de envio sem chegar a `sent`
- o dashboard deve mostrar de forma explicita o estado do `watchdog` e do `host companion`

## Reforco Multi-Grupo

- os grupos atuais conhecidos sao apenas exemplos iniciais, nao um limite de produto
- o sistema deve tratar `group-directory` como catalogo escalavel, nao como lista curta hardcoded
- uma mensagem de uma pessoa especifica pode originar um plano de distribuicao para `N` grupos destino
- a unidade de idempotencia para distribuicao multi-grupo deve ser:
  - `mensagem origem + grupo destino`
- falhas num grupo nao devem bloquear a distribuicao para os restantes grupos

## Modelo de Ownership

- `app owner`
  - dono global da aplicacao
  - pode gerir settings globais, auth, host lifecycle, terminal e qualquer grupo
- `group owner`
  - dono operacional de um ou mais grupos especificos
  - pode gerir apenas agendamentos, routing e aprovacoes dentro dos grupos que lhe pertencem
- `group owner` nao recebe por defeito privilegios globais de `app owner`

## Niveis de Acesso do Calendario

- `group`
  - acesso normal do grupo ao proprio calendario
  - por defeito: `read`
  - leitura e interacao limitada ao contexto do grupo atual
- `group_owner`
  - gestao do calendario dos grupos que possui
  - por defeito: `read_write`
  - pode criar, editar, aprovar, suprimir e reprocessar apenas nesses grupos
- `app_owner`
  - acesso global a qualquer calendario do sistema
  - por defeito: `read_write`
  - pode sobrepor politicas locais quando necessario
- os modos de acesso canonicos sao apenas:
  - `read`
  - `read_write`

## Consola WhatsApp

- a UI operacional inclui uma pagina `WhatsApp`
- essa pagina deve concentrar:
  - estado da sessao/auth usada pelo bot
  - grupos WhatsApp conhecidos pelo sistema
  - conversas privadas/pessoas conhecidas com `whatsapp_jid`
  - permissoes efetivas por grupo e por pessoa
  - `app owners`, `group owners` e ACL do calendario por grupo
- o backend deve expor um snapshot unico de workspace WhatsApp para esta pagina, em vez de obrigar a UI a compor varios endpoints sem contexto

## Principios de UX do Frontend

- o frontend novo nao deve parecer uma consola administrativa antiga nem um painel tecnico cru
- o utilizador-alvo pode ter pouco conhecimento tecnico
- a interface deve privilegiar:
  - linguagem simples
  - estados humanos claros
  - passos guiados
  - feedback imediato
  - navegacao previsivel
- a UI nao deve obrigar o utilizador a interpretar:
  - `jid`
  - ids internos
  - nomes tecnicos de modulos
  - diferenca estrutural entre evento base, job, tentativa e sinal
  sem uma camada de traducao visual
- o frontend deve usar divulgacao progressiva:
  - por defeito mostra o essencial
  - detalhes tecnicos ficam atras de vistas secundarias, drawers ou modo avancado
- o ecran inicial deve responder de forma rapida a:
  - o WhatsApp esta ligado?
  - ha algo para fazer agora?
  - houve falhas?
  - qual e o proximo passo recomendado?
- criar ou editar entidades sensiveis deve acontecer por fluxos guiados:
  - criar aviso/agendamento
  - distribuir mensagem para multiplos grupos
  - configurar permissoes
  - ligar ou reparar WhatsApp
- o frontend deve parecer moderno e intencional:
  - layout limpo
  - hierarquia visual forte
  - contraste bom
  - tipografia legivel
  - componentes coerentes
  - sem aspeto "dated" de backoffice antigo

## Estrutura principal

- `docs/architecture/`
  - arquitetura conceptual e especificacao modular
- `docs/reuse/`
  - manifesto do codigo atual que foi copiado para reaproveitamento
- `docs/deployment/`
  - plano de runtime em `LXD`
- `source/`
  - monorepo workspace do projeto novo
- `legacy_healthy_code/`
  - referencia residual do projeto atual
  - `ready_to_port/` foi removido na `Wave 17` por ja estar supersedido
  - `reference_engines/` ficou como ultima referencia para comportamento de `alerts` e `automations`
- `runtime/lxd/`
  - layout preparado para publicar builds para um container `LXD`

## OAuth Codex

O caminho canonico no host deve ser:

- `/home/eliaspc/.codex/auth.json`

No runtime isolado, a aplicacao deve ver esse ficheiro em:

- `/codex/auth.json`

Se houver fontes secundarias/backup, devem ser montadas como fontes explicitas do `codex_auth_router`, nunca como substituicao silenciosa da fonte canonica.
O ponto importante e este: o projeto deve gerir o mesmo ficheiro live que o Codex usa, nao uma copia paralela escondida.

## Fluxo de build/deploy pretendido

1. Desenvolver e testar em `source/`.
2. Gerar artefactos para o core app e para o host companion.
3. Publicar o core app para `runtime/lxd/release-bundles/` ou `runtime/lxd/host-mounts/app-release/`.
4. Publicar o host companion para `runtime/host/`.
5. O container `LXD` consome apenas o artefacto publicado, nao o source tree inteiro como local de edicao.
6. Dados persistentes do runtime ficam separados do source.

O fluxo canónico de release passa por:

- `pnpm run validate:release`
- backend publicado em `runtime/lxd/host-mounts/app-release/current/`
- bundle versionado em `runtime/lxd/release-bundles/`
- host companion publicado em `runtime/host/current/`
- unit file do host em `runtime/host/systemd-user/lume-hub-host.service`

## Documentos mais importantes

- [AGENTS.md](/home/eliaspc/Documentos/lume-hub/AGENTS.md)
- [lume_hub_rewrite_master_prompt.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md)
- [lume_hub_modular_implementation_spec.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md)
- [lume_hub_implementation_waves.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_implementation_waves.md)
- [lume_hub_gap_audit.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md)
- [lume_hub_lxd_runtime_plan.md](/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_lxd_runtime_plan.md)
- [lume_hub_release_publish.md](/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_release_publish.md)

## Estado atual

As `Wave 0` a `Wave 56` ja foram executadas e validadas.
O `LumeHub` ja tem:

- runtime `Live` operacional com WhatsApp, LLM, scheduling, alerts e automations
- readiness de migracao exposta na pagina `Migracao`
- GUI live do `codex auto router` para preparar a melhor conta e fazer switch manual
- endpoint `GET /api/migrations/readiness`
- checklist de `shadow mode` em [lume_hub_shadow_mode_checklist.md](/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_shadow_mode_checklist.md)
- checklist de cutover em [lume_hub_live_cutover_checklist.md](/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_live_cutover_checklist.md)

Em `2026-04-06`, o bloqueador principal para substituir de vez o `WA-notify` ja nao e tecnico: passa a ser a execucao real da semana paralela e a decisao final de cutover.
O `LumeHub` ja mostra readiness de migracao, checklist de `shadow mode` e consola do `codex auto router` na pagina `Migracao`, mas o cutover total do `WA-notify` continua dependente de uma semana paralela real antes da decisao final.

Mas isso nao significa, por si so, que o `WA-notify` ja deva ser desligado.

Em `2026-04-06`, a leitura canonica passa a ser esta:

- o `LumeHub` ja esta forte em arquitetura, UI, ownership, media, knowledge por grupo e runtime live base
- o `LumeHub` ja nao depende do `WA-notify` para:
  - fluxo live de alteracao efetiva de calendario
  - `alerts`
  - `automations`
- a ronda de paridade e migracao ficou fechada do ponto de vista de implementacao
- o que sobra para decidir cutover total e:
  - shadow mode com dados reais
  - decisao operacional final
- por isso, a recomendacao atual e:
  - `shadow mode`
  - ou migracao parcial por areas
  - nao cutover total imediato
- a ronda curta de operacao de migracao tambem ficou fechada com a `Wave 51`
- a validacao consolidada mais recente do backlog ativo passou a ser `validate:wave56`
- a `Wave 52` ja fechou a fundacao do modelo `group-first`
- a `Wave 53` ja fechou a shell `group-first`, com switcher global de grupo e navegacao principal curta
- a `Wave 54` ja fechou a pagina operacional de grupo, com owner, modos e politicas locais persistentes
- a `Wave 55` ja fechou o calendario semanal como vista operacional principal, com create/edit/deactivate inline e leitura clara de `pending`, `waiting_confirmation` e `sent`
- a `Wave 56` ja fechou o roteamento por modo de grupo entre calendario, assistente e distribuicao
O storage canonico de inteligencia por grupo ja ficou aberto com:

- `data/groups/<jid>/llm/instructions.md`
- `data/groups/<jid>/knowledge/`
- `data/groups/<jid>/knowledge/index.json`

O `assistant-context` ja usa `llm/instructions.md` como fonte canonica de instrucoes por grupo.
Tambem ja existe retrieval isolado por grupo a partir de `knowledge/index.json` e documentos markdown da pasta `knowledge/`, para evitar mistura de contexto entre grupos com referencias parecidas.
O runtime live do assistente e do scheduling ja audita de forma visivel que instrucoes e snippets locais de grupo entraram em cada run relevante.
O template canonico inicial para preencher `llm/instructions.md` por grupo ficou em [lume_hub_group_llm_instructions_template.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_group_llm_instructions_template.md).
O storage canonico de media recebida tambem ja ficou aberto com:

- `data/runtime/media/assets/<assetId>/binary`
- `data/runtime/media/assets/<assetId>/metadata.json`
- `data/runtime/media/library.json`

O inbound live de media recebida tambem ja esta fechado com:

- ingest automatica a partir do WhatsApp live
- API de biblioteca operacional
- pagina `Media` no frontend live para ver origem, caption e metadata
- distribuicao multi-grupo em runtime com:
  - `assetId` na queue
  - envio live por `sendMedia()`
  - retry apenas dos grupos falhados
  - auditoria por alvo na `instruction-queue`
- fluxo guiado na pagina `Media` para:
  - escolher o video recebido
  - selecionar grupos manualmente
  - criar `dry_run`
  - disparar envio confirmado
  - rever estado por grupo

Tambem ja existe uma pagina `Projeto` para trabalho agentico sobre o proprio repo:

- rota `/workspace`
- pesquisa de ficheiros do `LumeHub`
- preview local de ficheiros
- runs em modo `plan` ou `apply`
- execucao real via `codex exec` confinada ao repo
- historico recente com ficheiros alterados
- aprovacao explicita antes de `apply`
- bloqueio de concorrencia para nao correr dois `apply` destrutivos ao mesmo tempo
- auditoria visivel do pedido, do modo, da aprovacao e do resultado
- guardrails de backend e estado de fila expostos na propria pagina

Neste momento:

- o frontend operacional das `Wave 13` a `Wave 16` ficou fechado
- a `Wave 17` limpou stubs mortos, docs obsoletas e legado ja supersedido
- a `Wave 18` fechou a composition root e o runtime real de backend em memoria
- a `Wave 19` fechou HTTP real, WebSocket real e o `Live` verdadeiro servido pelo backend
- a `Wave 20` fechou WhatsApp live com QR, descoberta de grupos/conversas e envio live com sinais de entrega
- a `Wave 21` fechou o pipeline conversacional live com:
  - `llm-codex-oauth` real
  - `llm-openai-compat` real
  - `codex-auth-router` a preparar/reportar auth no provider OAuth
  - inbound WhatsApp ligado a `ConversationService`, reply policy e envio live
  - catalogo de modelos exposto em `/api/llm/models`
- a `Wave 22` fechou:
  - `weekly-planner` real no dominio
  - `Semana` ligada ao backend real
  - endpoints live para schedules, queue, logs, LLM e `send`
- a `Wave 23` fechou:
  - diagnostico persistido de runtime em `runtime/backend-runtime-state.json`
  - endpoint `GET /api/runtime/diagnostics`
  - launcher com readiness, phase, ultimo tick e sinais WhatsApp
  - checklist de operacao real em `docs/deployment/lume_hub_live_cutover_checklist.md`
  - malha minima de regressao com testes unit, integration e e2e
- a `Wave 24` fechou:
  - limpeza final da ronda de runtime real
  - poda dos validadores historicos supersedidos
  - simplificacao dos comandos operacionais para release e validacao final
  - alinhamento final de docs e backlog ao estado real
- ronda fechada recentemente:
  - `Wave 25` a `Wave 29` para instrucoes LLM e knowledge base por grupo
  - objetivo: separar storage canonico de policy, instrucoes LLM e conhecimento documental local por grupo e fechar o uso live auditavel dessa memoria
- ronda de media distribuida fechada:
  - `Wave 30` a `Wave 34`
  - objetivo fechado: storage canonico, ingest live, distribuicao multi-grupo, UX guiada e limpeza final da ronda
- ronda do agente de projeto fechada:
  - `Wave 39` a `Wave 42`
  - objetivo fechado: pagina `Projeto`, agente live sobre o repo, diff por ficheiro, aprovacao, guardrails e limpeza final da serie
- ronda de paridade e migracao fechada:
  - `Wave 43` a `Wave 49`
  - objetivo fechado: paridade tecnica com o `WA-notify`, readiness live de migracao, suite verde e limpeza final da ronda
- regra de processo:
  - qualquer nova ronda de waves deve terminar com uma wave final de limpeza do repositorio
- o runtime `Live` atual continua a ser o estado canonico do produto novo
- mas a migracao total do `WA-notify` so deve ser decidida depois da semana paralela real
