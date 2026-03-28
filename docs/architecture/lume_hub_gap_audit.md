# Lume Hub Gap Audit

Data: `2026-03-28`

Objetivo:
- descrever apenas os gaps reais que restam depois das `Wave 0` a `Wave 22`
- evitar backlog preso a estado antigo do frontend ou a scaffolds ja removidos

## Resumo executivo

Conclusao curta:
- as `Wave 0` a `Wave 22` ficaram executadas e validadas
- a `Wave 20` fechou o canal WhatsApp live com QR, descoberta e envio observavel
- a `Wave 21` fechou o pipeline conversacional live e os providers LLM reais
- a `Wave 22` fechou a API operacional principal e o `weekly-planner` real
- o frontend operacional ja existe e a limpeza final do repositorio foi feita
- o modo `Live` ja usa backend HTTP real, WebSocket real e launcher local sem servidor provisório
- o backlog restante voltou a estar organizado em waves ativas
- o backlog restante esta concentrado em robustez, cobertura e fecho limpo da ronda

Plano ativo de fecho:

- `Wave 23`
  - hardening, cobertura e cutover para uso real
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

### 1. A cobertura de testes continua curta para o produto final

Estado atual:
- continuam a existir poucos testes centrais:
  - `source/tests/unit/notification-job-cleanup-policy.test.mjs`
  - `source/tests/integration/wave11-hardening.test.mjs`
  - `source/tests/e2e/dashboard-operations.test.mjs`

Impacto:
- as validacoes por wave sao uteis, mas a malha de regressao ainda e pequena para producao

Onde fechar:
- `source/tests/*`
- e idealmente suites locais em packages criticos

### 2. O cutover para uso real ainda precisa de hardening operacional

Estado atual:
- o modo `Live` ja permite:
  - criar e editar agendamentos reais
  - preparar e enfileirar distribuicoes reais
  - consultar queue, diagnostics e logs
  - usar o `Assistente` com providers reais
- continua em falta fechar a ronda com:
  - testes de restart e recover mais fortes
  - validacao de sessoes longas em `Live`
  - checklist clara de cutover
  - observabilidade minima para suporte

Onde fechar:
- `source/tests/*`
- `source/apps/lume-hub-backend`
- `source/apps/lume-hub-host`
- `runtime/`
- `docs/deployment/`

### 3. `alerts` e `automations` sairam do workspace ativo

Estado atual:
- os antigos packages `source/packages/modules/alerts` e `source/packages/modules/automations` eram stubs vazios
- foram removidos na `Wave 17` para nao fingirem funcionalidade inexistente
- ficou apenas `legacy_healthy_code/reference_engines/` como referencia residual de comportamento

Regra daqui para a frente:
- so reintroduzir estas areas quando houver desenho, contratos e validacao reais

## Ordem recomendada para o backlog restante

1. `Wave 23`
2. `Wave 24`

## Nota final

Se a pergunta for "as waves planeadas ficaram fechadas?", a resposta e:
- nao
- continuam abertas `Wave 23` e `Wave 24`

Se a pergunta for "o produto ja esta 100% implementado em runtime real?", a resposta e:
- nao
- o que falta ja nao e scaffold nem wiring operacional principal
- falta sobretudo reforco de testes, hardening e fecho de cutover
