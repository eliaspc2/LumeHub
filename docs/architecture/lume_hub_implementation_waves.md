# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara

## Estado atual

Nao ha waves pendentes neste momento.
As `Wave 0` a `Wave 17` ja foram executadas e validadas.

O backlog restante do projeto deixou de viver neste ficheiro e passou a ficar apenas em:

- `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md`

## Regras de leitura

Antes de abrir uma wave nova, ler:

1. `/home/eliaspc/Documentos/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/lume-hub/README.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro
6. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md`

## Pontos que continuam fechados

1. timezone explicita
   - default `Europe/Lisbon`
   - guardada em settings e visivel na UI
2. schema version por ficheiro de calendario por grupo
   - cada `calendar/YYYY-MM.json` inclui `schemaVersion`
3. escrita atomica e lock
   - nao escrever ficheiros canonicos diretamente sem lock
4. reconciliacao apos restart
   - jobs em `waiting_confirmation` devem ser revistos no arranque
5. supressao granular
   - deve ser possivel desativar um aviso sem apagar o evento base
6. cleanup com arquivo
   - eventos/avisos passados saem da vista ativa com politica clara de arquivo
7. heartbeat entre `lume-hub-backend` e `lume-hub-host`
8. modo de teste
   - deve existir forma de testar entregas sem mexer na regra real de producao
9. escala multi-grupo
   - nao assumir um conjunto pequeno fixo de grupos
10. fan-out por pessoa/remetente
11. idempotencia por `mensagem origem + grupo destino`
12. falha parcial controlada
13. ACL explicita do calendario com `group`, `group_owner` e `app_owner`

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

Rebuild minimo esperado:

- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se tocar backend, HTTP, WS ou runtime:

- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada
