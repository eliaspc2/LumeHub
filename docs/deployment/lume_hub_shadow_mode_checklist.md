# LumeHub Shadow Mode Checklist

Data de referencia: `2026-03-30`

Objetivo:
- acompanhar uma semana real com `WA-notify` e `LumeHub` em paralelo
- expor rapidamente onde ha divergencia antes de cortar o sistema antigo

## Pre-condicoes minimas

- `Wave 48` validada com:
  - `corepack pnpm run validate:wave48`
- `WA-notify` continua a ser a referencia produtiva
- `LumeHub` abre em `Live` sem erro
- a pagina `Configuracao` mostra:
  - `Shadow mode e readiness de migracao`
  - checklist sem bloqueadores tecnicos

## O que comparar durante a semana

### 1. Schedules

- abrir a semana real no `WA-notify`
- abrir a mesma semana no `LumeHub`
- comparar:
  - eventos visiveis
  - horas
  - grupos alvo
  - notas relevantes

### 2. Envios e fan-out

- para cada aviso importante, confirmar:
  - se o `WA-notify` enviou
  - se o `LumeHub` teria enviado para os mesmos grupos
  - se o estado ficou coerente na fila e na auditoria

### 3. Assistente

- testar pedidos reais em grupo ou em privado
- comparar:
  - entendimento do contexto
  - referencia a `Aula 1`, `VC1`, etc.
  - clareza da resposta
  - se a memoria de grupo usada pelo `LumeHub` bate certo com o grupo atual

### 4. Alerts e automations

- confirmar se regras legacy importadas continuam a disparar onde deviam
- confirmar se execucoes recentes em `Configuracao` refletem o comportamento esperado

## Matriz curta de comparacao

- `WA-notify`
  - referencia produtiva durante a semana paralela
  - o que ele faz continua a valer como verdade operacional
- `LumeHub`
  - sistema novo observado em paralelo
  - deve reproduzir schedules, respostas, alerts e automations sem regressao evidente

## Criterios para decidir cutover no fim

- nao apareceu regressao funcional evidente ao longo da semana
- o operador conseguiu usar:
  - `Hoje`
  - `Semana`
  - `Assistente`
  - `WhatsApp`
  - `Media`
  sem depender do `WA-notify` para tarefas normais
- a auditoria do `LumeHub` explica bem:
  - alteracoes de scheduling
  - envios
  - respostas do assistente
- o snapshot `GET /api/migrations/readiness` continua sem bloqueadores

## Se algo falhar

- manter o `WA-notify` como producao
- guardar:
  - logs do launcher
  - snapshot de `/api/runtime/diagnostics`
  - snapshot de `/api/migrations/readiness`
- registar a divergencia antes de reabrir novas waves
