# Lume Hub Healthy Code Manifest

Este documento diz que partes do `WA-Notify` atual foram copiadas para dentro deste projeto novo e como devem ser tratadas.

## Filosofia

Nem todo o codigo atual deve ser herdado.
Foi separado em dois grupos:

1. `ready_to_port`
   - codigo pequeno, coeso e com boa probabilidade de ser portado quase diretamente
2. `reference_engines`
   - codigo util, mas mais acoplado ao desenho atual
   - serve mais como referencia de comportamento do que como base literal

## Origem do snapshot

Origem principal:

- `/home/eliaspc/Containers/wa-notify/app`

## Pasta `legacy_healthy_code/ready_to_port`

Ficheiros copiados:

- `src/agent_intent.ts`
  - heuristicas pequenas e aproveitaveis para distinguir instrucoes do agente
- `src/codex_auth_router.ts`
  - logica util para roteamento entre contas OAuth Codex
- `src/commands_config.ts`
  - normalizacao simples de configuracao de comandos/autorizacoes
- `src/commands_logs.ts`
  - append/read de logs NDJSON pequenos
- `src/discipline_catalog.ts`
  - catalogo e normalizacao de disciplinas/cursos
- `src/llm_codex_oauth.ts`
  - integracao concreta com Codex OAuth, util como base para o adapter novo
- `src/llm_config.ts`
  - config simples da camada LLM
- `src/llm_logs.ts`
  - logs NDJSON para operacoes LLM
- `src/people_memory.ts`
  - memoria simples de pessoas com escrita atomica
- `src/wa_messages_logs.ts`
  - serializacao de logs de mensagens WhatsApp

Ficheiros auxiliares copiados:

- `package.json`
- `tsconfig.json`
- `examples/commands.example.json`
- `examples/people.memory.example.json`

## Pasta `legacy_healthy_code/reference_engines`

Ficheiros copiados:

- `src/alerts.ts`
  - motor simples de matching por regras
- `src/automations.ts`
  - motor util para automacoes com offsets
- `src/delivery_watchdog.ts`
  - referencia forte para watchdog e diagnostico operacional

Ficheiros auxiliares copiados:

- `examples/alerts.example.json`
- `examples/automations.example.json`

## Excluido de proposito

Os ficheiros seguintes nao foram copiados como base de implementacao:

- `src/wa.ts`
- `src/schedules.ts`
- `src/commands.ts`
- `src/server.ts`
- `src/llm.ts`
- `src/instruction_queue.ts`

Motivo:

- concentram demasiado acoplamento do desenho atual
- foram os pontos mais tocados pelos bugs reais da manutencao recente
- devem ser reescritos segundo a arquitetura nova, usando o comportamento antigo apenas como referencia

## Regra para a nova LLM implementadora

Se precisares de comportamento antigo:

1. consulta primeiro `ready_to_port`
2. depois consulta `reference_engines`
3. so vai ao projeto antigo completo se ainda faltar contexto

O snapshot copiado aqui nao substitui a nova arquitetura; ele existe para acelerar a reimplementacao, nao para a limitar.

## Diferenca importante face ao projeto novo

O projeto novo nao deve herdar do sistema atual a ideia de storage canonico disperso.
A arquitetura agora fica fechada em torno de:

- pastas por grupo e calendario mensal como fonte canonica dos schedules
- numero variavel de avisos por evento
- estados de envio `pending -> waiting_confirmation -> sent`
