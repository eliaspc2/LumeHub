# Lume Hub Implementation Waves

Este ficheiro mantem apenas waves ainda por executar.

Regra editorial:
- waves concluidas devem sair daqui
- o plano ativo deve ficar curto e legivel
- novas waves so devem ser criadas quando existir trabalho suficientemente coeso, validavel e com fronteira clara
- sempre que abrir uma nova ronda de waves, essa ronda deve terminar com uma wave final de limpeza

## Estado atual

As `Wave 0` a `Wave 24` ja foram executadas e validadas.
O runtime `Live` atual continua funcional, mas foi aberta uma nova ronda para memoria e instrucoes LLM por grupo.

## Ronda ativa

### Wave 25 - Storage canonico de inteligencia por grupo

Objetivo:
- tornar canonico que cada grupo tenha a sua propria pasta de inteligencia LLM
- deixar de depender apenas de `prompt.md` generico
- preparar storage por grupo para instrucoes LLM e base de conhecimento

Entregaveis:
- layout canonico por grupo com:
  - `data/groups/<jid>/llm/instructions.md`
  - `data/groups/<jid>/knowledge/`
  - `data/groups/<jid>/knowledge/index.json`
- `GroupPathResolver` e `GroupDirectoryService` a exporem estes caminhos novos
- compatibilidade de leitura para `prompt.md` legacy durante a transicao
- `assistant-context` a carregar `llm/instructions.md` como fonte primaria

Criterios de aceitacao:
- cada grupo passa a ter um espaco proprio para instrucoes LLM
- grupos com naming parecido deixam de partilhar contexto implicitamente
- o sistema continua funcional com workspaces antigos enquanto houver migracao

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave25`

Melhor momento para testar:
- logo no fim desta wave, porque aqui fechamos o layout canonico em disco

O que testar:
- verificar no filesystem de um grupo onde ficam as instrucoes LLM
- confirmar que um grupo sem `llm/instructions.md` ainda continua operacional via compatibilidade legacy
- confirmar que o backend arranca sem quebrar workspaces ja existentes

### Wave 26 - Knowledge base por grupo e retrieval isolado

Objetivo:
- dar a cada grupo uma base de conhecimento propria
- impedir que referencias parecidas entre grupos contaminem o contexto umas das outras

Entregaveis:
- modulo ou servico de `group knowledge` com repositorio por grupo
- suporte a documentos markdown e indice simples em `knowledge/index.json`
- retrieval local por grupo para snippets relevantes
- `assistant-context` a incluir:
  - instrucoes LLM do grupo
  - snippets relevantes da knowledge base do grupo
  - nunca snippets de outro grupo

Criterios de aceitacao:
- duas conversas sobre "Aula 1" em grupos diferentes devolvem contexto diferente quando o conhecimento do grupo divergir
- o contexto enviado a LLM passa a ter fontes de grupo rastreaveis

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave26`

Melhor momento para testar:
- aqui, porque e o ponto certo para validar ambiguidade entre grupos parecidos

O que testar:
- criar knowledge docs diferentes em dois grupos com referencias semelhantes
- confirmar que o assistente usa o conhecimento certo em cada grupo
- confirmar que um grupo sem knowledge docs continua a responder sem crash

### Wave 27 - API e UI para gerir instrucoes e conhecimento por grupo

Objetivo:
- permitir ao operador editar instrucoes LLM e knowledge base por grupo sem mexer manualmente em ficheiros

Entregaveis:
- endpoints para:
  - ler/escrever `llm/instructions.md`
  - listar/adicionar/editar/remover docs da knowledge base do grupo
  - preview do contexto efetivo do grupo
- UI no frontend para:
  - editar instrucoes LLM por grupo
  - gerir knowledge docs por grupo
  - ver preview do contexto que segue para a LLM

Criterios de aceitacao:
- um app owner consegue configurar tudo pela UI
- a UI deixa claro que estas instrucoes sao locais ao grupo
- fica visivel que grupos diferentes podem ter regras semanticas diferentes

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave27`

Melhor momento para testar:
- aqui, porque e o primeiro ponto em que a feature fica verdadeiramente utilizavel por operador

O que testar:
- editar instrucoes LLM de um grupo
- criar e apagar docs de knowledge base
- abrir preview de contexto
- confirmar em browser headless que as paginas novas montam sem erros

### Wave 28 - Uso live da memoria de grupo no assistente e scheduling

Objetivo:
- fazer a conversa live e o scheduling consumirem de facto a inteligencia local do grupo

Entregaveis:
- `agent-runtime` e `conversation pipeline` a usar contexto enriquecido por grupo
- `schedule_parse` e respostas conversacionais com contexto group-scoped
- auditoria/logs a mostrar quando houve uso de instrucoes ou knowledge do grupo
- guardrails para nao misturar contexto entre grupos ou chats privados errados

Criterios de aceitacao:
- o assistente usa normas e conhecimento do grupo certo em runtime live
- o operador consegue perceber porque resposta/contexto foram produzidos

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run validate:wave28`

Melhor momento para testar:
- aqui, porque ja da para testar o comportamento real do produto em `Live`

O que testar:
- mensagens live em grupos com normas diferentes
- referencias ambiguas a aulas
- preview e logs de contexto usados
- ausencia de cross-contamination entre grupos

### Wave 29 - Limpeza final da ronda de inteligencia por grupo

Objetivo:
- remover naming legacy e lixo tecnico/documental deixado pela ronda

Entregaveis:
- limpeza do uso residual de `prompt.md` se ja nao for preciso
- docs finais alinhadas ao storage canonico novo
- validadores e scripts intermédios supersedidos removidos

Criterios de aceitacao:
- o repo fica sem duplicacao de caminhos antigos e novos sem necessidade
- a ronda fecha com backlog claro e sem residuos evitaveis

Rebuild e validacao minima:
- `corepack pnpm run validate:wave29`

Melhor momento para testar:
- no fim da ronda, para confirmar que a limpeza nao partiu o fluxo final

O que testar:
- regressao geral de `Live`
- leitura/escrita de instrucoes LLM por grupo
- knowledge base por grupo
- ausencia de referencias legacy desnecessarias na documentacao operacional

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

- reintroduzir `alerts` e `automations` no workspace

Essas areas so devem voltar se houver necessidade real de produto, desenho novo e validacao propria.
