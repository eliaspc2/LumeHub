# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:

- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza
- cada pedido deve executar apenas uma wave
- se o utilizador pedir mais do que uma wave na mesma sequencia, assumir erro de instrucao, nao executar as waves extra e pedir/esperar clarificacao explicita

## Estado atual

Ronda ativa: `ui-ux-commercial-polish`.

A `Wave 74` abriu a ronda com auditoria UI/UX page-by-page, correcao de foco/scroll automatico e contratos globais de densidade.

Waves ainda por executar:

### Wave 75 - Grupos e WhatsApp sem repeticao operacional

Objetivo:
- reduzir repeticoes nos ecras com mais duplicacao textual
- transformar listas repetidas em resumo + detalhe progressivo
- manter claro quem pode agir, que grupo esta em foco e qual e o proximo passo

Scope:
- `/groups`
- `/groups/:groupJid`
- `/whatsapp`

Obrigatorio:
- `/groups` deve parecer catalogo curto de grupos, nao a pagina detalhada duplicada
- `/groups/:groupJid` deve mostrar trabalho desse grupo sem repetir a lista global inteira
- permissao WhatsApp/ACL deve aparecer como resumo humano antes do detalhe tecnico
- repetir nomes de grupos, owners, `Assistente ligado` e `Com agendamento` so quando houver comparacao real

Validacao:
- criar `validate:wave75`
- recarregar desktop e mobile das tres rotas em browser headless/CDP
- confirmar que nao ha regressao de foco em inputs nem saltos de scroll no load inicial

### Wave 76 - Hoje, Calendario e LLM com resumo primeiro

Objetivo:
- tornar as paginas de operacao diaria mais rapidas de perceber
- esconder ruido tecnico ate ser necessario
- reduzir chips/contadores vazios

Scope:
- `/today`
- `/week`
- `/assistant`

Obrigatorio:
- `Hoje` deve responder em poucos segundos: estado, risco, proximo passo
- `Calendario` deve esconder estados a zero por defeito
- `LLM` deve separar melhor pergunta segura de alteracao real de agenda
- copy deve continuar pensada para utilizador pouco tecnico

Validacao:
- criar `validate:wave76`
- validar rotas desktop/mobile
- verificar input da LLM a escrever varios caracteres sem perder foco

### Wave 77 - LumeHub, Codex Router e rotas tecnicas por papel

Objetivo:
- separar operacao normal de diagnostico tecnico
- manter informacao sensivel e tecnica em detalhe progressivo
- melhorar legibilidade comercial das areas de sistema

Scope:
- `/settings`
- `/codex-router`
- `/media`
- `/workspace`
- `/distributions`
- `/delivery-monitor`
- `/watchdog`

Obrigatorio:
- `Codex Router` deve manter uso livre, token em uso e troca manual, mas com diagnostico tecnico recolhido
- `Workspace` deve deixar de repetir dezenas de acoes iguais por ficheiro
- `Media` deve evitar JIDs crus na vista base quando houver label humana
- rotas tecnicas devem mostrar impacto e proximo passo antes do log/diagnostico

Validacao:
- criar `validate:wave77`
- validar `Codex Router` live sem imprimir tokens
- validar rotas tecnicas em browser headless/CDP

### Wave 78 - Limpeza final da ronda `ui-ux-commercial-polish`

Objetivo:
- fechar a ronda, remover validadores intermédios e deixar docs/README/backlog canonicos
- relancar o LumeHub no fim da limpeza

Obrigatorio:
- consolidar a validacao final em `validate:wave78`
- remover validadores intermédios `74..77`, se ja estiverem cobertos
- atualizar README, gap audit e esta lista para declarar a ronda fechada
- relancar no fim:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart`
  - se for a partir de sessao automatizada, usar `setsid bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart >/tmp/lumehub-wave-restart.log 2>&1 < /dev/null &`
- validar a seguir:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh status`
  - `curl -fsS http://127.0.0.1:18420/api/runtime/diagnostics`

A validacao consolidada atual e:

- `cd /home/eliaspc/Documentos/lume-hub/source`
- `corepack pnpm run validate:wave74`

## Ultimas rondas fechadas

A ronda `group-first` ficou fechada com a limpeza final da `Wave 60`.
Estado canonico deixado:

- calendario semanal como vista operacional principal
- paginas por grupo como unidade de configuracao e trabalho
- modos `com_agendamento` e `distribuicao_apenas` fechados no runtime e na UI
- ownership por grupo e politica de tag ao bot com enforcement real
- `WhatsApp`, `LumeHub`, `Migracao` e `LLM` como areas separadas e claras
- chat direto com a LLM em escopo global ou de grupo, separado de `preview/apply`

A ronda `ui-clarity` ficou fechada com a limpeza final da `Wave 65`.
Estado canonico deixado:

- pagina `LLM` mais clara e com menos espaco morto
- objetos internos repetiveis e reconheciveis em vez de excecoes visuais por pagina
- linguagem mais simples para utilizadores nao tecnicos
- shell mais coesa sem sacrificar fluxo real nem observabilidade

A ronda `commercial-readiness` ficou fechada com a limpeza final da `Wave 72`.
Estado canonico deixado:

- `Hoje` como homepage comercial real
- estados de loading, erro e vazio em linguagem humana
- `Calendario`, `LLM`, `Grupos`, `WhatsApp`, `LumeHub` e `Codex Router` separados por papel e tarefa
- `Migracao` saiu da UI navegavel depois do cutover; ficam apenas APIs tecnicas de manutencao explicita
- configuracao de lembretes `1..N` por grupo, com janelas antes, hora fixa e depois
- copy de lembretes assistida pela LLM e auditavel como `gerado -> preparado -> enviado`
- `Codex Router` em pagina propria, com backup antes de trocar token e suporte a `3+` tokens
- kit de entrega comercial honesto para `backend containerizado + host companion`
- validadores intermédios da ronda removidos; a serie ficou consolidada em `validate:wave72`

A `Wave 73` fechou o cutover operacional de avisos e ownership OAuth.
Estado canonico deixado:

- LumeHub passa a aceitar `LUME_HUB_CODEX_AUTH_SOURCES` como contrato para `2+` contas OAuth externas
- `lume-hub-backend` e `lume-hub-host` carregam o mesmo ficheiro local `runtime/host/codex-auth-sources.env`
- o packaging publicado inclui `EnvironmentFile` opcional para manter o ownership OAuth fora de hacks manuais
- o host companion sincroniza o mesmo historico de backups do router usado pelo backend para o repositorio privado
- os avisos migrados do WA-Notify ficam no LumeHub como envio principal; a redundancia WA-Notify foi desativada no cutover total
- validacao consolidada: `validate:wave73`

A `Wave 74` abriu a ronda `ui-ux-commercial-polish`.
Estado canonico deixado:

- auditoria UI/UX page-by-page documentada em `lume_hub_ui_ux_audit_2026-04-22.md`
- confirmado que nao ha pagina branca real; o branco inicial era artefacto de captura/scroll
- load inicial deixou de forcar foco/scroll para o conteudo principal
- navegacao mobile ficou compacta em vez de ocupar um ecra inteiro antes do conteudo
- shell global ficou mais densa e menos tecnica
- validacao consolidada atual: `validate:wave74`

## Como reabrir uma ronda

Antes de abrir uma wave nova, ler:

1. `/home/eliaspc/Documentos/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/lume-hub/README.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro
6. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md`

Se surgir uma nova wave:

- terminar sempre com rebuild real do que foi tocado
- criar `validate:waveX` em `source/package.json`
- criar `scripts/validate-waveX.mjs`
- declarar explicitamente quando vale a pena o utilizador testar
- se houver edicao de frontend, recarregar a rota mexida num browser headless e confirmar que nao ha ecra branco nem erro relevante de runtime/consola
- se for aberta uma nova ronda, reservar desde logo a ultima wave dessa ronda para limpeza final

Rebuild minimo esperado:

- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se tocar backend, HTTP, WebSocket ou runtime:

- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada

Se a wave for a limpeza final de uma ronda com impacto no live:

- relancar no fim:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart`
  - se for a partir de sessao automatizada, destacar com `setsid bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart >/tmp/lumehub-wave-restart.log 2>&1 < /dev/null &`
- validar a seguir:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh status`
  - `curl -fsS http://127.0.0.1:18420/api/runtime/diagnostics`

## Fora de scope por defeito

- abrir rondas novas sem bloqueador real validado
- reintroduzir stubs ou backlog falso para areas ja fechadas
