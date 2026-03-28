# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 21` ja foram executadas e validadas.
O backlog restante continua organizado em waves de fecho para runtime real.

As waves ativas passam a ser:

- `Wave 22`
- `Wave 23`
- `Wave 24`

Objetivo desta nova ronda:

- sair de `demo shell + wiring parcial`
- chegar a backend real, API real, WhatsApp live, LLM real e cutover operacional

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
- se for aberta uma nova ronda:
  - reservar desde logo a ultima wave dessa ronda para limpeza final
  - essa wave deve remover lixo tecnico e documental criado ou tornado obsoleto pela propria ronda

Rebuild minimo esperado:

- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se tocar backend, HTTP, WS ou runtime:

- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada

## Waves ativas

## Wave 22 - API operacional completa e weekly planner real

Objetivo:
- fechar o missing surface de API e o backend real dos fluxos de planeamento

Entregaveis:
- endpoints operacionais em falta para schedules, queue, logs, LLM e send
- `weekly-planner` do dominio com comportamento real
- integracao da UI de `Semana` com backend real
- diagnostics e views operacionais consumidas pela UI sem dependencias de demo

Criterios de aceitacao:
- os fluxos principais de operacao deixam de depender de dados mockados/demo
- `Semana` passa a usar backend real
- queue, logs e diagnostics ficam acessiveis pelo produto

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave22`

Melhor momento para testar:
- testar aqui um fluxo operacional completo, porque ja deves conseguir criar, rever e acompanhar trabalho real dentro da app

O que testar:
- criar e editar agendamentos
- preview e confirmacao de distribuicoes
- leitura de queue, diagnostics e logs
- fluxos principais da homepage sem fallback de demo

## Wave 23 - Hardening, cobertura e cutover para uso real

Objetivo:
- fechar a ronda com robustez suficiente para substituicao real do sistema antigo

Entregaveis:
- reforco forte de testes unitarios, integracao e e2e
- validacoes de restart, recover e resiliencia
- checklist de operacao real e cutover
- observabilidade minima suficiente para suporte operacional
- afinacao final de packaging/launcher/runtime para uso diario

Criterios de aceitacao:
- a app pode ser usada em `Live` como substituicao funcional do sistema anterior
- restart, reconnect e recuperacao nao deixam o operador cego
- existe cobertura minima para evitar regressao imediata nas areas criticas

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run test`
- `corepack pnpm run validate:wave23`

Melhor momento para testar:
- este e o melhor ponto para piloto serio ou cutover, porque aqui ja faz sentido perguntar se o produto substitui o fluxo antigo sem reservas operacionais grandes

O que testar:
- uso em `Live` durante uma sessao longa
- restart do backend e do host companion
- reconnect do WhatsApp
- fluxos completos de agendamento, distribuicao, conversa e permissao
- verificacao do launcher, da pagina web e dos sinais operacionais

## Wave 24 - Limpeza final da ronda de runtime real

Objetivo:
- fechar a ronda `Wave 18` a `Wave 23` sem lixo tecnico nem documental

Entregaveis:
- remocao de stubs, adaptadores temporarios e validadores supersedidos pela ronda
- poda de notas, docs e backlog que tenham ficado ultrapassados
- limpeza de wiring temporario que tenha sido usado para migrar entre fases
- alinhamento final de `README.md`, `AGENTS.md`, `gap_audit` e plano de waves ao estado real

Criterios de aceitacao:
- o repositorio fica sem restos de transicao desnecessarios desta ronda
- o backlog final descreve apenas o que continuar realmente por fazer
- a documentacao principal descreve o sistema resultante e nao o caminho intermedio

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run test`
- `corepack pnpm run validate:wave24`

Melhor momento para testar:
- testar aqui a regressao final depois do cutover, para confirmar que a limpeza nao retirou nada importante

O que testar:
- arranque normal do produto em `Live`
- repeticao rapida dos fluxos principais das `Wave 18` a `Wave 23`
- verificacao da documentacao principal e do launcher
- confirmacao de que o repositorio ficou mais claro e nao mais opaco

## Fora de scope destas waves

- reintroduzir `alerts` e `automations` no workspace

Essas areas so devem voltar se houver necessidade real de produto, desenho novo e validacao propria.
