# Lume Hub Implementation Waves

Este ficheiro define a ordem recomendada de implementacao pendente do `Lume Hub`.
Serve para uma LLM ou equipa executar o projeto por fases, sem misturar fundamentos com features tardias.

Regra editorial:
- este ficheiro deve manter apenas waves ainda por executar
- waves ja concluidas devem sair daqui para o plano ativo ficar curto e legivel
- neste momento, as `Wave 0` a `Wave 16` ja foram executadas e por isso deixaram de aparecer neste ficheiro

## Regras de leitura

Antes de implementar qualquer wave, ler:

1. `/home/eliaspc/Documentos/lume-hub/AGENTS.md`
2. `/home/eliaspc/Documentos/lume-hub/README.md`
3. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md`
4. `/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md`
5. este ficheiro

## Pontos importantes acrescentados

Coisas que nao devem ficar esquecidas durante a implementacao:

1. timezone explicita
   - default `Europe/Lisbon`
   - guardada em settings e visivel na UI
2. schema version por ficheiro de calendario por grupo
   - cada `calendar/2026-03.json` deve incluir `schemaVersion`
   - migrations de ficheiro devem ser suportadas
3. escrita atomica e lock
   - nunca escrever ficheiros canonicos do grupo diretamente sem lock
4. reconciliacao apos restart
   - jobs em `waiting_confirmation` devem ser revistos no arranque
5. supressao granular
   - deve ser possivel desativar um aviso sem apagar o evento base
6. cleanup com arquivo, nao so delete cego
   - eventos/avisos passados devem sair da vista ativa, mas com politica clara de arquivo
7. heartbeat entre `lume-hub-backend` e `lume-hub-host`
   - para diagnosticar se o companion local caiu
8. modo de teste
   - deve existir forma de testar entregas sem mexer na regra real de producao
9. escala multi-grupo
   - nao assumir que o produto fica por `2-3` grupos
   - o diretório de grupos deve aguentar crescimento sem hardcodes
10. fan-out por pessoa/remetente
   - uma mensagem pode precisar de ser distribuida para `N` grupos destino
11. idempotencia de distribuicao
   - a chave operacional deve distinguir `mensagem origem + grupo destino`
12. falha parcial controlada
   - falhar um grupo nao pode bloquear os restantes
13. ACL explicita do calendario
   - distinguir `group`, `group_owner` e `app_owner`
   - mutacoes do calendario nunca devem contornar estes niveis
   - os modos canonicos devem ser `read` e `read_write`

## Waves ativas

As waves pendentes estao agora concentradas no frontend, UX e limpeza final do projeto.
O objetivo desta fase e modernizar a experiencia e aproximar o produto da usabilidade real.

As novas waves passam a ter quatro regras adicionais:

1. sempre que possivel, cada wave deve terminar com rebuild real do que foi tocado
2. cada wave nova deve ganhar o seu proprio `validate:waveX` em `source/package.json` e respetivo `scripts/validate-waveX.mjs`
3. cada wave deve declarar explicitamente quando e porque vale a pena o utilizador testar logo nessa fase
4. sempre que houver edicao de frontend, o FE deve ser recarregado num browser headless para confirmar que a pagina abre sem erro de runtime, sem ecra branco e sem erros relevantes de consola

Rebuild minimo esperado no fim de qualquer wave nova:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`

Se a wave tocar browser/app web:
- rebuild da web app
- preview local executavel para teste manual
- depois de cada alteracao relevante de frontend, recarregar pelo menos a rota mexida num browser headless
- verificar explicitamente:
  - se a UI monta
  - se nao ha erro de runtime no browser
  - se nao ha ecra branco
  - se a consola nao mostra erros relevantes
- esta verificacao deve acontecer durante a implementacao e outra vez no fecho da wave

Se a wave tocar backend, HTTP, WS ou runtime:
- smoke test dedicado da wave
- validar que a UI continua a abrir e a consumir a API esperada

## Wave 17 - Limpeza final e remocao de legado inutil

Objetivo:
- remover informacao, ficheiros e codigo de apoio que deixaram de ser necessarios
- fechar o projeto com uma base mais limpa para manutencao

Entregaveis:
- limpeza de docs obsoletos ou duplicados
- remocao de codigo morto, stubs supersedidos e assets antigos sem uso
- remocao de `legacy_healthy_code/` que ja nao seja preciso como referencia
- remocao de snapshots, notas e placeholders que ja nao acrescentem contexto
- atualizacao final de `README.md`, `AGENTS.md` e backlog para refletir apenas o estado real

Regra forte desta wave:
- apagar `legacy_healthy_code/` ou partes dele apenas quando o comportamento ja estiver portado, validado e sem dependencia documental relevante

Criterios de aceitacao:
- o repositorio deixa de ter material antigo que confunde mais do que ajuda
- o codigo saudavel guardado so permanece se ainda for referencia viva
- a documentacao principal descreve o sistema atual e nao o seu passado

Rebuild e validacao minima:
- `corepack pnpm run typecheck`
- `corepack pnpm run build`
- `corepack pnpm run test`
- `corepack pnpm run validate:wave17`

Melhor momento para testar:
- testar aqui regressao geral e arranque normal do produto depois da limpeza
- e a melhor wave para confirmar que nada importante foi apagado por engano
- a pergunta pratica desta wave e: `o projeto ficou mais simples sem perder capacidade?`

O que testar:
- arrancar o sistema de forma normal depois da limpeza
- repetir rapidamente os fluxos principais das waves `13` a `16`
- confirmar que docs principais ainda explicam o sistema certo
- verificar se nao desapareceu nenhuma referencia ainda util ao migrar ou depurar
- confirmar que o repositorio esta mais claro e nao mais opaco

## Regra de execucao para a LLM

- completar uma wave antes de saltar para a seguinte
- no fim de cada wave:
  - atualizar docs locais relevantes
  - criar ou atualizar `validate:waveX`
  - fazer rebuild do que foi tocado
  - validar com testes/typecheck
  - se houve mudancas no frontend, recarregar a app no browser headless e verificar erros antes de dar a wave por pronta
  - indicar explicitamente se e um bom momento para teste manual do utilizador
  - deixar estado explicito do que ficou pronto e do que falta
