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
- `corepack pnpm run validate:wave66`

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

- `validate:wave66` passa a ser a validacao consolidada do estado atual desta ronda
- o `Codex Router` ja ficou exposto como pagina propria em `/codex-router`
- a shell ja tem contratos visuais mais fortes; agora falta torná-los mais comerciais e mais autoexplicativos

A `Wave 66` ja fechou a homepage comercial e os estados de carga humanos desta ronda:

- `Hoje` passou a homepage real do produto e primeira rota de entrada
- `Calendario` continua operacional, mas deixou de ser a primeira impressao do produto
- loading, offline, erro e vazio passaram a explicar o estado em linguagem humana e com acoes de recuperacao
- a shell cortou jargao transversal na navegacao, na homepage e nos estados de suporte
- a validacao dedicada ficou registada em `validate:wave66`

### Wave 67 - Calendario e LLM com foco operacional

Objetivo:
- tornar `Calendario` e `LLM` mais diretos, mais densos e menos intrusivos

Entrega esperada:

- `Calendario`:
  - mostrar primeiro um resumo simples da semana
  - empurrar a grelha detalhada para segundo nivel
  - trocar estados internos `pending`, `waiting_confirmation`, `sent` por linguagem humana
  - abrir detalhe de dia/evento em painel lateral, drawer ou padrao equivalente
- `LLM`:
  - manter o chat como tarefa principal
  - esconder o bloco de scheduling ate existir intencao clara de alterar agenda
  - recolher ou fechar por defeito a rail lateral fora de `/assistant`
  - cortar ruido e espaco morto nas listas curtas, preview e auditoria

Vale a pena o utilizador testar no fim:

- leitura rapida do `Calendario`
- fluxo `perguntar` vs `agir` no `LLM`
- comportamento da rail lateral

### Wave 68 - Lembretes por grupo, janelas temporais e copy assistida pela LLM

Objetivo:
- transformar lembretes por grupo numa funcionalidade configuravel, legivel e comercial, sem empurrar o operador para uma consola de regras crua

Entrega esperada:

- `Grupos` e `Grupo detalhado`:
  - permitir configurar `1..N` lembretes por grupo
  - permitir regras diferentes por lembrete, incluindo:
    - `x tempo antes`
    - hora fixa no dia anterior
    - hora fixa no proprio dia
    - `x tempo depois`
  - resumir cada lembrete em linguagem humana:
    - `24h antes`
    - `dia anterior as 18:00`
    - `30 min depois`
- `Calendario`:
  - mostrar quantos lembretes ativos existem por evento/grupo
  - mostrar o proximo disparo previsto sem obrigar a abrir detalhe tecnico cedo demais
- `LLM` e configuracao de copy:
  - permitir definir o texto base enviado para a LLM por lembrete
  - suportar prompts orientados ao momento do lembrete, por exemplo:
    - `daqui a X horas temos o evento Y`
    - `ultima oportunidade para fazer o teste X`
    - `ja passou X tempo desde o evento Y`
  - expor variaveis canonicas e preview do resultado antes de ativar
- `Queue` e runtime:
  - assumir explicitamente que a `instruction-queue` vai crescer com `1..N` lembretes por evento/grupo
  - garantir dedupe, cancelacao quando o evento muda e auditoria clara de `gerado -> preparado -> enviado`
  - manter a fila legivel para operador pouco tecnico, com resumos e prioridade em vez de IDs por defeito

Vale a pena o utilizador testar no fim:

- criar varios lembretes no mesmo grupo
- misturar `antes`, `hora fixa` e `depois`
- rever preview do texto que vai para a LLM
- alterar um evento e confirmar que a fila e os lembretes acompanham a mudanca

### Wave 69 - Grupos e WhatsApp como fluxos guiados

Objetivo:
- tornar a operacao diaria em `Grupos` e `WhatsApp` compreensivel para pessoa pouco tecnica

Entrega esperada:

- `Grupos`:
  - fluxo claro `escolher grupo -> ver estado atual -> alterar`
  - reduzir repeticao de switches e texto longo na lista de grupos
  - mostrar estado sintetico e CTA principal por grupo
- `Grupo detalhado`:
  - separar `Resumo`, `Permissoes`, `Automacao` e `Conhecimento`
  - evitar misturar selects, ajuda longa e switches na mesma linha ou grelha apertada
  - manter largura legivel e blocos informativos curtos
- `WhatsApp`:
  - responder primeiro a:
    - `esta ligado?`
    - `o que falta?`
    - `qual o proximo botao?`
  - empurrar `identidades conhecidas`, listas grandes e detalhe tecnico para segundo nivel
  - tratar reparacao/sessao como wizard de estado, nao como consola crua

Vale a pena o utilizador testar no fim:

- escolher e gerir um grupo
- perceber o estado do canal WhatsApp sem ajuda externa

### Wave 70 - LumeHub, Codex Router e Migracao por papel

Objetivo:
- separar melhor produto base, gestao de tokens e consola de operador

Entrega esperada:

- `LumeHub`:
  - dividir em `Basico` e `Avancado`
  - manter na vista base apenas controlos de produto e saude operacional
  - esconder detalhes de provider, tokens e energia atras de `details` ou modo expert
- `Codex Router`:
  - manter a pagina propria ja aberta nesta baseline
  - alinhar copy e divulgacao progressiva da pagina para linguagem mais humana
  - esconder diagnostico tecnico pesado por defeito
- `Migracao`:
  - converter a leitura atual num wizard de operador com `3-5` passos
  - esconder comparativos internos, `shadow mode` e detalhe tecnico por defeito
  - reforcar que esta pagina nao e a homepage normal do produto

Vale a pena o utilizador testar no fim:

- diferenca entre `LumeHub`, `Codex Router` e `Migracao`
- leitura da pagina `Migracao` sem conhecimento tecnico previo

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
