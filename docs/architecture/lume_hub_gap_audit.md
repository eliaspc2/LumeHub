# Lume Hub Gap Audit

Data: `2026-03-28`

Objetivo:
- descrever apenas os gaps reais que restam depois das `Wave 0` a `Wave 23`
- evitar backlog preso a estado antigo do frontend ou a scaffolds ja removidos

## Resumo executivo

Conclusao curta:
- as `Wave 0` a `Wave 23` ficaram executadas e validadas
- a `Wave 20` fechou o canal WhatsApp live com QR, descoberta e envio observavel
- a `Wave 21` fechou o pipeline conversacional live e os providers LLM reais
- a `Wave 22` fechou a API operacional principal e o `weekly-planner` real
- o frontend operacional ja existe e a limpeza final do repositorio foi feita
- o modo `Live` ja usa backend HTTP real, WebSocket real e launcher local sem servidor provisório
- o backlog restante voltou a estar organizado em waves ativas
- a `Wave 23` fechou o hardening principal com:
  - diagnostico persistido de runtime
  - `GET /api/runtime/diagnostics`
  - launcher com resumo operacional real
  - checklist de cutover em `docs/deployment/lume_hub_live_cutover_checklist.md`
  - testes novos de unit, integration e e2e
- o backlog restante ficou reduzido a limpeza final da ronda

Plano ativo de fecho:

- `Wave 24`
  - limpeza final da ronda de runtime real

Em particular, ja nao faz sentido falar de:

- frontend textual
- `Wave 13` a `Wave 17` como futuro
- `ready_to_port/` como dependencia viva
- `alerts` e `automations` como packages do workspace final

Esses pontos foram limpos ou fechados na `Wave 17`.

## O que ja esta solido

As seguintes areas existem com base razoavel:

- scheduler por semanas, eventos, regras e jobs
- delivery tracker, dispatcher, watchdog e health monitor
- ownership, ACL e fan-out multi-grupo
- host companion, auth router e packaging basico
- runtime WhatsApp live com:
  - QR
  - sessao real
  - descoberta de grupos e conversas
  - sincronizacao para `group-directory` e `people-memory`
  - envio live com observacao e confirmacao forte
- shell web operacional com:
  - dashboard
  - fluxos guiados
  - pagina WhatsApp
  - permissoes e ownership
  - modo `advanced details`
  - foco em acessibilidade base e confianca operacional

## Gaps reais por prioridade

### 1. Falta fechar a limpeza final da ronda

Estado atual:
- a parte funcional do cutover ficou fechada na `Wave 23`
- o que resta ja nao e wiring principal nem hardening base
- continua por fazer a poda final da ronda:
  - remover notas temporarias
  - decidir se sobram validadores ou wiring de transicao
  - alinhar docs principais ao estado resultante

Onde fechar:
- `docs/*`
- `source/scripts/*`
- `runtime/*`

### 2. `alerts` e `automations` sairam do workspace ativo

Estado atual:
- os antigos packages `source/packages/modules/alerts` e `source/packages/modules/automations` eram stubs vazios
- foram removidos na `Wave 17` para nao fingirem funcionalidade inexistente
- ficou apenas `legacy_healthy_code/reference_engines/` como referencia residual de comportamento

Regra daqui para a frente:
- so reintroduzir estas areas quando houver desenho, contratos e validacao reais

## Ordem recomendada para o backlog restante

1. `Wave 24`

## Nota final

Se a pergunta for "as waves planeadas ficaram fechadas?", a resposta e:
- nao
- continua aberta `Wave 24`

Se a pergunta for "o produto ja esta 100% implementado em runtime real?", a resposta e:
- ainda falta a limpeza final da ronda
- mas o hardening, o cutover e a malha minima de regressao ficaram fechados na `Wave 23`
