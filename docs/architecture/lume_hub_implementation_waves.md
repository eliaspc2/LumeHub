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
- `corepack pnpm run validate:wave70`

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

A partir de `2026-04-20` abre a ronda `commercial-readiness`.
Esta ronda nasce da auditoria `headless` comercial feita sobre as paginas principais e existe para transformar a shell atual numa experiencia mais vendavel, mais guiada e mais honesta para utilizadores pouco tecnicos.

Objetivo da ronda:

- promover uma homepage comercial clara em vez de uma primeira impressao demasiado operacional
- tornar estados de loading, erro e proximo passo mais explicitos
- simplificar cada pagina principal por papel e por tarefa, em vez de misturar demasiados conceitos no mesmo ecran
- separar melhor o que e produto base, o que e consola de operador e o que e detalhe tecnico
- preparar um kit de entrega comercial honesto para `backend containerizado + host companion`

Base deixada antes desta ronda:

- a validacao consolidada atual desta ronda passou a ser `validate:wave70`
- o `Codex Router` ja ficou exposto como pagina propria em `/codex-router`
- a shell ja tem contratos visuais mais fortes; agora falta torná-los mais comerciais e mais autoexplicativos

A `Wave 66` ja fechou a homepage comercial e os estados de carga humanos desta ronda:

- `Hoje` passou a homepage real do produto e primeira rota de entrada
- `Calendario` continua operacional, mas deixou de ser a primeira impressao do produto
- loading, offline, erro e vazio passaram a explicar o estado em linguagem humana e com acoes de recuperacao
- a shell cortou jargao transversal na navegacao, na homepage e nos estados de suporte
- a validacao dedicada ficou registada em `validate:wave66`

A `Wave 67` ja fechou `Calendario` e `LLM` com foco operacional:

- `Calendario` passou a abrir com leitura rapida da semana, detalhe em foco e grelha completa em segundo nivel
- estados internos como `pending`, `waiting_confirmation` e `sent` deixaram de aparecer como linguagem principal
- `LLM` ficou `chat-first`, com scheduling recolhido por defeito e auditoria curta sob divulgacao progressiva
- a validacao consolidada atual passou a ser `validate:wave67`

A `Wave 68` ja fechou lembretes por grupo, janelas temporais e copy assistida pela LLM:

- `Grupos` e `Grupo detalhado` passaram a permitir `1..N` lembretes por grupo, com regras `antes`, hora fixa e `depois`
- `Calendario` passou a mostrar o proximo lembrete e o ciclo `gerados -> preparados -> enviados` por evento
- a configuracao de copy passou a expor variaveis canonicas, preview da mensagem base e prompt opcional para a LLM
- a `instruction-queue` passou a tratar lembretes como trabalho auditavel e deduplicado, com cancelacao quando o evento muda
- a validacao consolidada atual passou a ser `validate:wave68`

A `Wave 69` ja fechou `Grupos` e `WhatsApp` como fluxos guiados:

- `Grupos` passou a ter fluxo explicito `escolher grupo -> ver estado atual -> alterar`
- a lista de grupos deixou de repetir switches grandes e passou a usar estado sintetico, badges e CTA principal por grupo
- `Grupo detalhado` ficou separado em `Resumo`, `Permissoes`, `Automacao` e `Conhecimento`
- `WhatsApp` passou a responder primeiro a `esta ligado?`, `o que falta?` e `qual o proximo botao?`
- identidades, conversas privadas e permissoes detalhadas ficaram atras de divulgacao progressiva
- a reparacao do canal passou a ter wizard curto por foco: auth, grupos ou permissoes
- a validacao consolidada atual passou a ser `validate:wave69`

A `Wave 70` ja fechou `LumeHub`, `Codex Router` e `Migracao` por papel:

- `LumeHub` passou a ter vista `Basico` para regras globais e saude operacional, com `Avancado` recolhido
- provider LLM, energia, auth, tokens e governanca ficaram atras de divulgacao progressiva
- `Codex Router` ficou com linguagem humana, contrato de backup antes de trocar e escolha manual de token recolhida
- `Migracao` passou a wizard de operador em 4 passos e deixou de mostrar comparativos internos/shadow mode por defeito
- a validacao consolidada atual passou a ser `validate:wave70`

### Wave 71 - Kit de entrega comercial e packaging honesto

Objetivo:
- transformar a conclusao operacional da auditoria num pacote de entrega comercial realista

Entrega esperada:

- bundle ou imagem do backend containerizado
- pacote do `host companion` fora do container
- mounts canonicos para:
  - `data`
  - `logs`
  - `auth`
- guias curtos de:
  - install
  - update
  - health check
  - recovery de token/auth
- explicitar na documentacao de entrega o limite atual:
  - nao vender isto como `um container unico` se o `host companion` continuar obrigatorio

Vale a pena o utilizador testar no fim:

- instalacao guiada num ambiente limpo ou equivalente
- checklist de health check e recovery

### Wave 72 - Limpeza final da ronda `commercial-readiness`

Objetivo:
- fechar a ronda mais limpa e mais coerente do que abriu

Entrega esperada:

- consolidar a ronda em `validate:wave72`
- remover copy de transicao, backlog duplicado e helpers/documentacao obsoletos da serie `66..71`
- alinhar:
  - `README`
  - `gap_audit`
  - `implementation_waves`
  - referencias no backlog externo
- se a ronda tocar o `LumeHub` live, terminar com:
  - relancamento real do produto
  - verificacao de saude no fim

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
