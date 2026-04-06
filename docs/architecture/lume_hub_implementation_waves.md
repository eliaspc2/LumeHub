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

Nao ha waves ativas neste momento.

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
