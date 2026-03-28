# Lume Hub Gap Audit

Data: `2026-03-28`

Objetivo:
- descrever apenas gaps reais ainda ativos para o produto scoped atual
- evitar backlog preso a estado antigo, scaffolds removidos ou rondas de implementacao ja fechadas

## Resumo executivo

Conclusao curta:
- as `Wave 0` a `Wave 26` ficaram executadas e validadas
- o canal WhatsApp live ficou fechado com QR, descoberta e envio observavel
- o pipeline conversacional live e os providers LLM reais ficaram integrados
- a API operacional principal e o `weekly-planner` real ficaram fechados
- hardening, cutover, observabilidade minima e limpeza final da ronda ficaram concluidos
- o modo `Live` ja usa backend HTTP real, WebSocket real e launcher local sem servidor provisório
- a partir de `2026-03-28` abriu uma nova ronda de feature para inteligencia LLM por grupo
- a `Wave 25` ja fechou o storage canonico com `llm/instructions.md`, `knowledge/` e fallback legacy para `prompt.md`
- a `Wave 26` ja fechou a knowledge base por grupo com retrieval isolado no `assistant-context`

Em particular, ja nao faz sentido falar de:

- frontend textual
- `Wave 13` a `Wave 17` como futuro
- `ready_to_port/` como dependencia viva
- backlog ativo preso a waves ja fechadas
- `alerts` e `automations` como packages do workspace final

## O que ja esta solido

As seguintes areas existem com base razoavel:

- scheduler por semanas, eventos, regras e jobs
- delivery tracker, dispatcher, watchdog e health monitor
- ownership, ACL e fan-out multi-grupo
- host companion, auth router e packaging operacional
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
- malha minima de regressao com:
  - unit
  - integration
  - e2e
  - `validate:wave24`

## Gaps ativos da ronda nova

### 1. Falta API/UI de operacao para essa inteligencia de grupo

Estado atual:
- nao ha editor de instrucoes LLM por grupo
- nao ha gestao de documentos de conhecimento por grupo
- nao ha preview claro do contexto que segue para a LLM

Impacto:
- o operador ainda teria de mexer manualmente em ficheiros para gerir esta camada

### 2. Falta uso live auditavel dessa memoria de grupo

Estado atual:
- o `assistant-context` injeta `groupPrompt` e `groupPolicy`
- a fonte canonica de instrucoes do grupo ja existe
- a knowledge base por grupo ja existe com retrieval isolado
- mas nao existe auditoria completa e visivel de uso dessa memoria em conversa live e scheduling

Impacto:
- falta confianca operacional quando houver grupos parecidos com normas divergentes

## Gaps ativos da ronda seguinte prevista

### 1. Media recebida ainda nao e guardada como asset distribuivel

Estado atual:
- o runtime conhece mensagens inbound com `videoMessage` e `imageMessage`
- mas o caminho operacional real continua centrado em `sendText()`
- nao existe repositorio canonico de assets recebidos

Impacto:
- se um operador mandar um video por WhatsApp, o sistema hoje nao o consegue guardar como asset reutilizavel e depois distribuir por varios grupos

### 2. Nao existe fan-out de media com tracking forte

Estado atual:
- queue, dedupe e tracking existem para texto
- nao existe `sendMedia()` nem acao de queue propria para media

Impacto:
- falta o fluxo "guardar video uma vez e distribuir para N grupos com retry e confirmacao"

### 3. Falta biblioteca operacional de media recebida

Estado atual:
- nao ha listagem de assets media recebidos
- nao ha preview de origem, caption ou metadata tecnica minima

Impacto:
- o operador nao tem como recuperar um video recebido e reutiliza-lo mais tarde no produto

## Trabalho futuro fora do scope atual

### 1. `alerts` e `automations`

Estado atual:
- os antigos packages `source/packages/modules/alerts` e `source/packages/modules/automations` eram stubs vazios
- foram removidos na `Wave 17` para nao fingirem funcionalidade inexistente
- ficou apenas `legacy_healthy_code/reference_engines/` como referencia residual de comportamento

Regra daqui para a frente:
- so reintroduzir estas areas quando houver desenho, contratos e validacao reais

## Nota final

Se a pergunta for "as waves planeadas ficaram fechadas?", a resposta e:
- sim
- para a ronda anterior, sim
- mas existe agora uma ronda nova aberta para inteligencia LLM por grupo

Se a pergunta for "o produto ja esta 100% implementado em runtime real?", a resposta e:
- para o runtime operacional base, sim
- para a nova feature de memoria e instrucoes LLM por grupo, maioritariamente
- para media recebida e distribuicao multi-grupo de video, ainda nao
