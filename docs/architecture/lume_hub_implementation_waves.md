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
- `corepack pnpm run validate:wave60`

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

### Wave 62 - Pagina `LLM` mais clara, mais densa e com menos ruido

Objetivo:
- refazer a pagina `/assistant` para separar melhor `perguntar`, `agir` e `auditar`, com hierarquia muito mais obvia

Escopo:
- transformar o topo da pagina num workbench mais simples, com menos blocos equivalentes a competir pela mesma atencao
- reduzir redundancia entre `hero`, `chat vs acao`, `modo acao` e `preview`
- encolher estados vazios e listas curtas para eliminar grandes zonas brancas
- usar melhor a largura disponivel no desktop sem esmagar a leitura em mobile
- manter o fluxo real `chat direto` vs `preview/apply`, mas com copy e fronteiras muito mais simples

Validacao minima:
- `cd /home/eliaspc/Documentos/lume-hub/source`
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- smoke dedicado da rota `/assistant`
- confirmar que chat, preview e apply continuam acessiveis sem regressao funcional

Quando vale a pena o utilizador testar:
- sim; esta e a wave certa para testar cedo e ajustar a direcao antes de migrar o resto da shell

### Wave 63 - Linguagem canonica e divulgacao progressiva

Objetivo:
- simplificar a linguagem da UI e reduzir a mistura entre termos operacionais, tecnicos e internos

Escopo:
- rever labels, hints, empty states, badges e summaries da experiencia `LLM`
- trazer primeiro linguagem de acao e resultado; detalhes tecnicos passam para segundo plano
- alinhar nomes e mensagens curtas entre `LLM`, `Migracao`, `LumeHub` e vistas de grupo
- garantir que estados como `sem preview`, `bloqueado`, `ligado`, `a rever` e `pronto` aparecem sempre com o mesmo padrao

Validacao minima:
- `cd /home/eliaspc/Documentos/lume-hub/source`
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- smoke das rotas tocadas com revisao manual do copy principal

Quando vale a pena o utilizador testar:
- opcional; faz sentido se houver duvidas sobre o tom ou a clareza da nova linguagem

### Wave 64 - Migracao da shell restante para os novos objetos

Objetivo:
- propagar a linguagem visual e estrutural nova para o resto das areas principais sem voltar a criar excecoes

Escopo:
- migrar `Migracao`, `LumeHub`, `WhatsApp` e vistas principais de grupo para os novos objetos internos
- reduzir uso excessivo de `metric-card` e grelhas quando a informacao pede listas compactas ou blocos assimetricos
- alinhar barras laterais, paines secundarias, auditorias e estados vazios com a nova densidade
- remover padroes que continuem a depender de espaco vazio para parecer organizados

Validacao minima:
- `cd /home/eliaspc/Documentos/lume-hub/source`
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- smoke das rotas principais tocadas nesta wave
- confirmar que desktop e mobile mantem leitura clara

Quando vale a pena o utilizador testar:
- sim; aqui ja se ve a coerencia global da shell e vale a pena validar se a app ficou realmente mais simples

### Wave 65 - Limpeza final da ronda `ui-clarity`

Objetivo:
- fechar a ronda mais limpo do que abriu, sem helpers, classes ou copy que tenham ficado obsoletos

Escopo:
- remover CSS, helpers e variacoes de componentes supersedidas pela ronda
- consolidar validacao final da serie
- alinhar README e docs ao estado final
- garantir que a shell nao fica com dois dialetos visuais a conviver

Validacao minima:
- `cd /home/eliaspc/Documentos/lume-hub/source`
- `corepack pnpm run validate:wave65`

Fecho esperado da ronda:

- pagina `LLM` muito mais clara e com menos espaco morto
- objetos internos repetiveis e reconheciveis em vez de excecoes visuais por pagina
- linguagem mais simples para utilizadores nao tecnicos
- shell mais coesa sem sacrificar fluxo real nem observabilidade

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
