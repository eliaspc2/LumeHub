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

A `Wave 76` fechou `Hoje`, `Calendario` e `LLM` com leitura de resumo primeiro.

Waves ainda por executar:

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

- `cd /home/eliaspc/Documentos/Git/lume-hub/source`
- `corepack pnpm run validate:wave76`

## Ronda seguinte reservada

Depois de fechar a `Wave 78`, abrir a ronda `gui-simplification-pass-2`.

Motivo:

- a shell ficou melhor, mas o produto ainda pode parecer assoberbante quando uma pagina junta resumo, diagnostico, labels repetidas e varias acoes primarias ao mesmo tempo
- o proximo passo ja nao e "mais polish"; e simplificar a leitura operacional para reduzir fadiga e hesitacao
- revisao headless das rotas live confirma excesso de blocos simultaneos em `Hoje`, `Grupos`, `LumeHub` e `Codex Router`
- nesta ronda entram tambem:
  - um modulo novo para descarregar updates do LumeHub a partir do repo oficial
  - um radar live compacto em `Hoje` no lugar de atalhos pouco uteis

### Wave 79 - Alertas falsos e Hoje com radar live

Objetivo:
- corrigir sinais de alerta falsos antes de abrir nova simplificacao visual
- substituir `Atalhos principais` em `Hoje` por um radar live compacto e realmente util

Scope:
- `watchdog`
- tracking de reminders e reconciliacao de entrega
- homepage `/today`

Obrigatorio:
- auditar os alertas ativos vistos em `Hoje` e no inbox operacional para separar falha real de falso positivo
- se o problema vier do `watchdog`, do tracking de entrega ou da reconciliacao de ACK/accepted, fechar primeiro esse bug no runtime
- o contador de problemas em `Hoje` so pode subir por falha operacional com valor claro para o operador
- `Hoje` deixa de ter o bloco `Atalhos principais`
- no lugar entra uma janela pequena `Radar live` com sinais recentes de runtime, chats, envios e alertas reais
- o radar deve privilegiar linguagem curta, timestamps legiveis e leitura de cima para baixo
- se nao houver eventos, mostrar estado tranquilo em vez de caixa vazia ou ruido tecnico

Validacao:
- criar `validate:wave79`
- produzir pelo menos um caso real ou reproduzido que antes gerava alerta falso e confirmar que deixa de contaminar `Hoje`
- abrir `/today` em browser headless/CDP em `desktop` e `mobile` para confirmar que o radar cabe bem sem espaco morto

### Wave 80 - Shell e hierarquia com menos carga simultanea

Objetivo:
- reduzir a sensacao de excesso logo no primeiro viewport
- limitar quantas decisoes e quantas acoes primarias aparecem ao mesmo tempo
- reforcar a leitura "resumo primeiro, detalhe depois"

Scope:
- shell global
- headers de pagina
- barras de estado
- action rows e blocos de resumo partilhados

Obrigatorio:
- cada pagina deve abrir com um resumo unico e uma zona principal de trabalho, sem competir com tres ou quatro blocos equivalentes
- cada area deve ter no maximo uma acao primaria visivel; as restantes passam para secundarias ou menus coerentes
- chips, badges e linhas de copy que apenas repetem o titulo ou o estado principal devem sair da vista base
- detalhe tecnico e estados raros devem usar o mesmo contrato de divulgacao progressiva em vez de excecoes por pagina
- a ronda deve partir de revisao headless/screenshot das rotas live antes de mexer no layout, para atacar ruido real em vez de abstrato

Validacao:
- criar `validate:wave80`
- validar `desktop` e `mobile` em browser headless/CDP nas rotas com maior densidade
- confirmar menos ruido no first viewport sem regressao de foco, scroll ou acessibilidade base

### Wave 81 - Fluxos summary-first e linguagem mais direta

Objetivo:
- fazer com que o operador pouco tecnico perceba cada pagina em poucos segundos
- trocar texto explicativo por estado atual, decisao e proximo passo
- cortar metadado repetido em listas, cards e vazios

Scope:
- `/today`
- `/groups`
- `/groups/:groupJid`
- `/whatsapp`
- `/assistant`
- `/settings`
- `/codex-router`

Obrigatorio:
- as paginas base devem responder primeiro a "o que importa agora?" e so depois mostrar o resto
- loading, empty e erro devem ser curtos, humanos e orientados a acao
- listas e cards nao devem repetir o mesmo owner, grupo, modo ou estado em varios sitios sem comparacao real
- nomes tecnicos como `jid`, `runtime`, `diagnostics`, `provider` e hashes ficam fora da vista base quando houver traducao humana possivel
- `Hoje` deve perder blocos paralelos quando o mesmo estado ja aparece no resumo
- `Grupos` deve separar melhor catalogo, detalhe e configuracao para evitar um "mural" de caixas
- `LumeHub` e `Codex Router` devem reduzir cartoes concorrentes sem perder o proximo passo util

Validacao:
- criar `validate:wave81`
- validar escrita em inputs da LLM e dos formularios sem perda de foco
- rever screenshots desktop/mobile das paginas alvo para confirmar reducao de ruido e espaco morto

### Wave 82 - Modulo `official-update-sync` para updates via repo oficial

Objetivo:
- permitir ao LumeHub descobrir, descarregar e preparar updates a partir do repositorio oficial
- reduzir dependencia de procedimentos manuais dispersos no host
- dar ao operador uma leitura clara da versao atual, update disponivel e estado do download

Scope:
- novo modulo backend
- integracao com `lume-hub-host` para fetch e staging local
- superficie minima de operador na UI

Obrigatorio:
- usar apenas o repo oficial configurado como upstream canonico do LumeHub
- suportar pelo menos `check update`, `download update` e `preparar apply`, sem auto-aplicar por defeito
- guardar metadata de versao atual, versao remota, commit/tag e ultima verificacao
- descarregar para staging claro e validado antes de qualquer apply
- a UI deve ter um toggle `updates ligados/desligados` para permitir ao operador activar ou cortar esta capacidade sem mexer em config manual
- a vista base deve falar em versao atual, update disponivel e estado; branch, hash e detalhe git ficam recolhidos

Validacao:
- criar `validate:wave82`
- testar com fixture git local a simular o upstream oficial, sem depender de internet publica
- smoke HTTP/UI da verificacao e do download preparado

### Wave 83 - Limpeza final da ronda `gui-simplification-pass-2`

Objetivo:
- fechar a ronda e consolidar simplificacao visual, copy e modulo de updates
- relancar o LumeHub no fim da limpeza

Obrigatorio:
- consolidar a validacao final em `validate:wave83`
- remover validadores intermédios `79..82`, se ja estiverem cobertos
- atualizar README, gap audit e esta lista para declarar a ronda fechada
- relancar no fim:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart`
  - se for a partir de sessao automatizada, usar `setsid bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart >/tmp/lumehub-wave-restart.log 2>&1 < /dev/null &`
- validar a seguir:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh status`
  - `curl -fsS http://127.0.0.1:18420/api/runtime/diagnostics`

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

1. `/home/eliaspc/Documentos/Git/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/Git/lume-hub/README.md`
3. `/home/eliaspc/Documentos/Git/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/Git/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro
6. `/home/eliaspc/Documentos/Git/lume-hub/docs/architecture/lume_hub_gap_audit.md`

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
