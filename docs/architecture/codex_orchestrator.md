# Codex Orchestrator

O `codex-orchestrator` e a porta operacional direta para Codex gerir o LumeHub.
Ele nao substitui os modulos principais; reaproveita-os:

- `admin-config` para policy global
- `people-memory` para reconhecer o admin como `app_owner`
- `group-directory` para grupos, prompts por grupo e scope operacional
- `schedule-events` para eventos de agenda
- `automations` via settings para mensagens recorrentes/one-shot

## Contrato operacional

O admin fica configurado num ficheiro de texto:

```text
runtime/lxd/host-mounts/data/config/admin-phone.txt
```

O ficheiro deve conter um numero ou JID WhatsApp. Exemplos validos:

```text
+351910000000
351910000000@s.whatsapp.net
```

O comando:

```bash
corepack pnpm --dir source run codex:orchestrator -- admin sync --phone-file runtime/lxd/host-mounts/data/config/admin-phone.txt
```

normaliza o valor, atualiza `people.json` e garante que essa pessoa tem `globalRoles: ["app_owner"]`.

## Lockdown de conversa

O comando:

```bash
corepack pnpm --dir source run codex:orchestrator -- policy lockdown
```

configura a policy para o comportamento pedido:

- privado: apenas o admin configurado
- grupos: apenas grupos com `mode = "com_agendamento"` e `schedulingEnabled = true`
- grupos nao autorizados: sem resposta
- chats privados nao autorizados: sem resposta
- grupos autorizados: resposta apenas por tag ao bot ou reply a mensagem do bot

## Prompts por grupo

Cada grupo continua a ter o prompt canonico em:

```text
runtime/lxd/host-mounts/data/groups/<group-jid>/llm/instructions.md
```

Codex pode atualizar esse prompt com:

```bash
corepack pnpm --dir source run codex:orchestrator -- group prompt-set --group-jid <jid> --file <prompt.md>
```

## Agendamentos e mensagens recorrentes

Eventos pontuais usam o modulo `schedule-events`:

```bash
corepack pnpm --dir source run codex:orchestrator -- schedule create --group-jid <jid> --title "Aula" --at 2026-05-20T09:00:00+01:00 --message "Mensagem opcional"
```

Mensagens recorrentes/cron-like usam automations:

```bash
corepack pnpm --dir source run codex:orchestrator -- automation add-weekly --group-jid <jid> --days mon,wed --time 09:00 --message "Bom dia, lembrete da aula."
```

Para mensagem one-shot direta:

```bash
corepack pnpm --dir source run codex:orchestrator -- automation add-one-shot --group-jid <jid> --at 2026-05-20T09:00:00+01:00 --message "Mensagem agendada."
```

## Validacao

Validador dedicado:

```bash
corepack pnpm --dir source run validate:codex-orchestrator
```
