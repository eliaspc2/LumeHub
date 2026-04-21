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

Nao existem waves ativas neste momento.

A validacao consolidada atual e:

- `cd /home/eliaspc/Documentos/lume-hub/source`
- `corepack pnpm run validate:wave72`

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
- `Calendario`, `LLM`, `Grupos`, `WhatsApp`, `LumeHub`, `Codex Router` e `Migracao` separados por papel e tarefa
- configuracao de lembretes `1..N` por grupo, com janelas antes, hora fixa e depois
- copy de lembretes assistida pela LLM e auditavel como `gerado -> preparado -> enviado`
- `Codex Router` em pagina propria, com backup antes de trocar token e suporte a `3+` tokens
- kit de entrega comercial honesto para `backend containerizado + host companion`
- validadores intermédios da ronda removidos; a serie ficou consolidada em `validate:wave72`

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
