# LumeHub UI/UX Audit - 2026-04-22

Objetivo:
- olhar para cada pagina como uma solucao comercial para operador pouco tecnico
- reduzir espaco morto sem perder seguranca operacional
- separar operacao normal de diagnostico tecnico
- transformar repeticoes em resumos ou divulgacao progressiva

## Metodo

Foram revistas as rotas:

- `/today`
- `/week`
- `/groups`
- `/groups/:groupJid`
- `/whatsapp`
- `/settings`
- `/assistant`
- `/codex-router`
- `/distributions`
- `/delivery-monitor`
- `/watchdog`
- `/workspace`
- `/media`

Validacao visual:
- capturas headless desktop
- recheck mobile por CDP com perfil limpo e extensoes desligadas
- extracao de texto DOM para contar repeticoes de labels e blocos

Nota importante:
- Nao ha evidencia de pagina branca real.
- O branco visto nas primeiras capturas veio de artefacto do `google-chrome --screenshot` combinado com scroll/foco automatico para o `main`.
- Ainda assim, o comportamento confirmou um problema real de UX: a pagina podia saltar para baixo sem pedido explicito, especialmente em viewport pequeno.

## Principios desta ronda

- O primeiro ecra deve responder: esta tudo bem, ha algo urgente, qual e o proximo passo?
- Nomes de sistema devem ser traduzidos para linguagem de operacao: evitar `runtime`, `workspace`, `ACL`, `routing` quando o operador nao precisa disso.
- Repetir o mesmo texto so e aceitavel quando ajuda a comparar opcoes; se repetir estado igual em muitas linhas, vira resumo.
- Zeros tecnicos devem desaparecer por defeito. Exemplo: `Fechados 0`, `A confirmar 0`, `Por enviar 0`.
- Paginas tecnicas continuam acessiveis, mas a vista base deve ser humana e curta.

## Achados por pagina

### Hoje

Estado geral bom como homepage, mas ainda pode ficar mais comercial:
- ha duplicacao de acoes como `Ver agenda`
- os cartoes de metricas ocupam muito espaco para pouco conteudo
- `Problemas ativos` precisa explicar consequencia e acao, nao apenas numero

Direcao:
- manter 3 blocos: estado, o que precisa de atencao, atalhos
- esconder detalhe tecnico atras de `Ver diagnostico`

### Calendario

Problemas principais:
- a semana mostra muitos contadores a zero
- cada evento repete `Grupo`, `Dia`, `A confirmar 0`, `Fechados 0`
- a grelha semanal e util para operador, mas deve ser resumo primeiro e detalhe ao abrir evento

Direcao:
- esconder chips de estado vazios
- promover evento em foco e proximos passos
- deixar editor e lifecycle em detalhe progressivo

### Grupos e pagina de grupo

Problemas principais:
- `/groups` e `/groups/:groupJid` ficam visualmente quase iguais
- nomes dos grupos repetem varias vezes no mesmo ecra
- `Com agendamento`, `Assistente ligado`, `Responsavel` e `Mensagem base` repetem em blocos diferentes
- o fluxo guiado ajuda, mas ocupa muita altura antes da tarefa concreta

Direcao:
- `/groups` deve ser catalogo curto: escolher grupo, ver problema, abrir detalhe
- `/groups/:groupJid` deve ser pagina de trabalho desse grupo, sem repetir a lista toda
- trocar cards repetidos por um resumo persistente: owner, modo, assistente, lembretes, conhecimento

### WhatsApp

Problemas principais:
- a pagina repete permissao privada e contacto conhecido em muitas linhas
- a linguagem ainda mistura operador, ACL e diagnostico
- informacao por grupo e por pessoa aparece demasiado cedo

Direcao:
- topo com estado da sessao e reparacao guiada
- lista curta de problemas reais
- permissao detalhada so em `Ver permissoes`

### LumeHub

Estado geral bom como painel base, mas:
- ainda cruza produto, saude, LLM, energia, tokens e governanca
- `Codex Router` aparece como atalho e como area propria
- a parte avancada deve ser ainda mais claramente secundaria

Direcao:
- vista base: saude operacional, switches essenciais, ultimos sinais
- avancado: energia, providers, auth, owners e diagnostico

### LLM

Problemas principais:
- o chat esta mais claro, mas ainda ha copy duplicada sobre escopo seguro
- a parte de mudar agenda compete com a pergunta segura

Direcao:
- chat seguro como acao principal
- alteracao de agenda como fluxo separado e recolhido
- usar linguagem simples: `Perguntar`, `Preparar alteracao`, `Confirmar`

### Codex Router

Estado funcional bom:
- mostra tokens, estado e uso livre
- a troca manual esta visivel

Problemas de UX:
- ainda ha muitos detalhes tecnicos na vista base
- `Token em uso`, `Reserva`, `Ultimo sucesso` e leituras temporais repetem

Direcao:
- tabela primaria: conta, esta em uso, uso livre, pode trocar, ultimo check
- diagnostico tecnico recolhido
- acao manual sempre junto ao backup/sync-back esperado

### Media

Problemas principais:
- repete videos sem caption e JIDs crus
- as acoes por video sao iguais e ocupam muito espaco

Direcao:
- mostrar thumbnail/estado e origem humana
- acoes em menu ou uma acao primaria por linha
- esconder JID salvo quando nao for necessario para decisao

### Workspace

Problema mais forte de repeticao:
- `Abrir preview`, `Usar no pedido`, `Rever sem alterar` aparecem dezenas de vezes

Direcao:
- transformar a lista em seletor de ficheiros com uma barra de acoes unica
- manter apenas uma acao primaria por ficheiro
- agrupar por tipo ou pasta para reduzir scan visual

### Rotas tecnicas secundarias

`/distributions`, `/delivery-monitor` e `/watchdog` estao uteis, mas devem parecer consola operacional, nao paginas comerciais principais.

Direcao:
- manter acessiveis por diagnostico
- topo sempre com `o que aconteceu`, `impacto`, `proximo passo`
- nao competir com Hoje/Calendario/WhatsApp na navegacao normal

## Wave 74 aplicada

Alteracoes base:
- removeu foco automatico no primeiro load para evitar saltos de janela/scroll
- manteve foco no conteudo apenas quando o utilizador navega explicitamente
- compactou pads, gaps, cards, header e hero
- trocou `Runtime live` por `Sistema ligado`
- trocou `workspace desse grupo` por `pagina desse grupo`
- compactou a navegacao em viewport pequeno para nao empurrar o conteudo para longe

## Waves enfileiradas

Wave 75:
- Grupos e WhatsApp sem repeticao operacional

Wave 76:
- Hoje, Calendario e LLM com resumo primeiro e detalhe progressivo

Wave 77:
- LumeHub, Codex Router e rotas tecnicas com separacao entre operador e diagnostico

Wave 78:
- limpeza final da ronda `ui-ux-commercial-polish`
