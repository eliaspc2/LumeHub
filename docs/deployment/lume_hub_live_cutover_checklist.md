# LumeHub Live Cutover Checklist

Data de referencia: `2026-03-30`

Objetivo:
- fazer o cutover para `Live` com verificacao minima, rollback claro e sinais operacionais suficientes

## Antes de pensar em cutover

- usar o estado final da ronda de paridade como base canónica de readiness antes de qualquer decisao final
- correr primeiro:
  - `corepack pnpm run validate:wave51`
- seguir a semana paralela em:
  - [lume_hub_shadow_mode_checklist.md](/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_shadow_mode_checklist.md)
- confirmar na pagina `Configuracao`:
  - `Shadow mode e readiness de migracao`
  - ausencia de bloqueadores tecnicos no snapshot live

## Antes do cutover

- confirmar `Node 20` disponivel no host
- confirmar `auth.json` canonico do Codex presente e valido
- correr em `source/`:
  - `corepack pnpm run typecheck`
  - `corepack pnpm run build`
  - `corepack pnpm run validate:wave51`
- abrir o launcher `LumeHub`
- validar `KubuntuLTS/scripts/lumehub-launch.sh status`
  - `runtime running`
  - `ready healthy (ready)`
  - `wa open`

## No momento do cutover

- abrir `http://127.0.0.1:18420/today?mode=live`
- confirmar:
  - `Hoje` carrega sem erro
  - `WhatsApp pronto` ou estado equivalente coerente
  - `Pronto para operar` ou estado equivalente coerente
- abrir `Semana` e criar um agendamento real de teste
- abrir `Distribuicoes` e validar preview de fan-out
- abrir `WhatsApp` e confirmar:
  - sessao aberta ou QR claro para onboarding
  - grupos descobertos
  - conversas descobertas
  - owners e ACL visiveis
- abrir `Configuracao` e confirmar:
  - checklist de shadow mode sem bloqueadores
  - comparacao curta `WA-notify` vs `LumeHub`

## Verificacoes operacionais

- correr `lumehub-launch.sh status`
- validar:
  - ultimo `tick`
  - ausencia de `error`
  - grupos e conversas descobertos
  - sessoes WebSocket coerentes com browser aberto
- consultar:
  - `/api/status`
  - `/api/runtime/diagnostics`
  - `/api/migrations/readiness`

## Testes de resiliencia

- reiniciar backend pelo launcher e confirmar que:
  - a app volta a abrir em `Live`
  - os agendamentos continuam presentes
  - o diagnostico volta a `running`
- reiniciar o host companion e confirmar heartbeat novo
- forcar reconnect do WhatsApp e confirmar recuperacao da sessao

## Rollback minimo

- parar o launcher `LumeHub`
- voltar ao fluxo anterior
- guardar:
  - `~/.local/state/lumehub-launcher/logs/backend.log`
  - `~/.local/state/lumehub-launcher/logs/host.log`
  - snapshot de `/api/runtime/diagnostics`

## Sinais de pronto para uso serio

- `Live` mantem-se estavel numa sessao longa
- restart nao apaga estado operativo importante
- reconnect WhatsApp nao deixa o operador cego
- o launcher mostra readiness, runtime phase e ultimo tick sem ambiguidade
