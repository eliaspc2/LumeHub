# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 60` ja foram executadas e validadas.
A `Wave 60` fechou a limpeza final da ronda `group-first`, consolidando `validate:wave60`, removendo validadores intermédios da serie `52..59`, retirando rotas provisórias da pagina `LLM` e alinhando docs/README ao estado final.

A partir de `2026-04-17` abre a ronda `ui-clarity`.
Esta ronda existe para simplificar o frontend operacional, impor contratos de composicao mais fortes e atacar primeiro a pagina `LLM`, que hoje mistura demasiadas coisas ao mesmo tempo e desperdica largura/altura util.

Estado canonico deixado pela ronda `group-first`:

- calendario semanal como vista operacional principal
- paginas por grupo como unidade de configuracao e trabalho
- modos `com_agendamento` e `distribuicao_apenas` fechados no runtime e na UI
- ownership por grupo e politica de tag ao bot com enforcement real
- `WhatsApp`, `LumeHub`, `Migracao` e `LLM` como areas separadas e claras
- chat direto com a LLM em escopo global ou de grupo, separado de `preview/apply`

Validacao consolidada atual:

- `cd /home/eliaspc/Documentos/lume-hub/source`
- `corepack pnpm run validate:wave65`

## Ronda `ui-clarity`

Objetivo da ronda:

- reduzir carga cognitiva nas paginas operacionais mais densas
- passar de grids e cards genericos para poucos objetos internos com regras claras
- garantir padding interno canonico em caixas, botoes, headers e estados vazios
- cortar copy tecnica, redundante ou pouco guiada
- remover espaco morto sem perder legibilidade nem separar demais os fluxos reais

A `Wave 61` ja fechou a fundacao visual desta ronda:

- fechar tokens e regras de densidade para `hero`, `content-card`, `metric-card`, `empty-state`, `action-row` e blocos de auditoria
- separar claramente container externo, header e body interno de cada caixa
- garantir que botoes, toolbars e grupos de acoes ficam alinhados pelo proprio objeto e nao por compensacoes externas
- rever alturas minimas decorativas e paddings duplicados que estejam a gerar espaco morto
- documentar um conjunto curto de objetos internos reutilizaveis para o frontend

A `Wave 62` ja fechou a simplificacao estrutural da pagina `LLM`:

- separar melhor `perguntar`, `agir` e `auditar` no `/assistant`
- reduzir redundancia entre hero, rails e preview
- encolher estados vazios e listas curtas para cortar espaco morto
- usar melhor a largura no desktop sem piorar mobile
- manter o fluxo real `chat direto` vs `preview/apply`, mas com fronteiras muito mais claras

A `Wave 63` ja fechou a linguagem canonica e a divulgacao progressiva desta ronda:

- rever labels, hints, empty states, badges e summaries da experiencia `LLM`
- trazer primeiro linguagem de acao e resultado; detalhes tecnicos passam para segundo plano
- alinhar nomes e mensagens curtas entre `LLM`, `Migracao`, `LumeHub` e vistas de grupo
- garantir que estados como `sem preview`, `bloqueado`, `ligado`, `a rever` e `pronto` aparecem sempre com o mesmo padrao
- tratar o `codex auto router` como lista explicita de tokens, e nao apenas como caso `principal + secundario`
- validar explicitamente a UI e o runtime com `3+` tokens disponiveis

A `Wave 64` ja fechou a migracao da shell restante para os novos objetos:

- `WhatsApp`, `LumeHub`, `Migracao` e vistas principais de grupo passam a ler-se com o mesmo contrato visual base
- resumos operacionais deixam de depender tanto de `metric-card` e passam a usar listas de estado, colunas curtas e blocos compactos
- estados vazios, notas inline e caixas de contexto passam a usar o mesmo dialeto visual da pagina `LLM`
- a shell fica mais densa e previsivel sem precisar de espaco morto para aparentar ordem
- a validacao da ronda passa a existir em `validate:wave64`

A `Wave 65` ja fechou a limpeza final da ronda `ui-clarity`:

- a pagina `LLM` deixou de manter aliases de transicao quando ja existiam objetos genericos equivalentes
- os validadores intermédios `61..64` sairam da serie e a validacao consolidada passou a ser `validate:wave65`
- docs e README ficaram alinhados ao estado final da ronda, sem linguagem de transicao nem backlog falso
- o fecho da limpeza passa a incluir relancamento do `LumeHub` live e verificacao de saude no fim

Fecho deixado por esta ronda:

- pagina `LLM` muito mais clara e com menos espaco morto
- objetos internos repetiveis e reconheciveis em vez de excecoes visuais por pagina
- linguagem mais simples para utilizadores nao tecnicos
- shell mais coesa sem sacrificar fluxo real nem observabilidade

Nao ha waves ativas neste momento.

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
  - se essa limpeza tocar o `LumeHub` live, deve terminar com relancamento real do produto e verificacao de saude

Rebuild minimo esperado:

- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se tocar backend, HTTP, WS ou runtime:

- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada

Se a wave for a limpeza final de uma ronda com impacto no live:

- relancar no fim:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart`
  - se for a partir de sessao automatizada, destacar com:
    - `setsid bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh restart >/tmp/lumehub-wave-restart.log 2>&1 < /dev/null &`
- validar a seguir:
  - `bash /home/eliaspc/Documentos/Instruction/KubuntuLTS/scripts/lumehub-launch.sh status`
  - `curl -fsS http://127.0.0.1:18420/api/runtime/diagnostics`

## Fora de scope por defeito

- abrir rondas novas sem bloqueador real validado
- reintroduzir stubs ou backlog falso para areas ja fechadas
