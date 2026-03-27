# Lume Hub

Base do projeto `Lume Hub`, desenhado para reescrever o `WA-Notify` atual de raiz com arquitetura modular, orientada a objetos, portavel e preparada para runtime isolado.
O layout foi pensado primeiro para `LXD`, mas continua valido se mais tarde o runtime passar para `Incus` ou equivalente.

## Objetivo

Este projeto nasce com quatro separacoes claras:

1. `source/`
   - codigo-fonte canonico do projeto novo
   - aqui e onde a implementacao deve acontecer
2. `runtime/`
   - estrutura operacional para correr o sistema fora do codigo-fonte
   - neste momento esta preparada para `LXD`, sem instalar nada automaticamente
3. `docs/`
   - arquitetura alvo, regras de implementacao, reaproveitamento e plano de deploy
4. `legacy_healthy_code/`
   - referencia residual minima do sistema antigo
   - neste momento restam apenas `reference_engines/` para comportamentos ainda nao reintroduzidos de forma real

## Responsabilidades nao opcionais do produto

O projeto novo deve assumir explicitamente estas responsabilidades:

1. impedir deep sleep do PC quando o sistema precisa de continuar acordado
2. gerir o mesmo ficheiro OAuth live usado pelo Codex
3. instalar e manter persistencia de arranque no proprio PC
4. suportar numero variavel de avisos por evento
5. usar pastas por grupo como fonte canonica dos schedules
6. escalar de poucos grupos para muitos grupos sem pressupor um conjunto pequeno fixo
7. suportar distribuicao fan-out de uma mensagem para `N` grupos a partir de regras por pessoa/remetente

Isto nao fica "fora do projeto".
Fica modelado em modulos e deployables proprios.

## Dois deployables previstos

O desenho ideal passa a assumir dois programas do mesmo projeto:

1. `lume-hub-backend`
   - core app
   - pode correr em `LXD`
2. `lume-hub-host`
   - companion local no proprio PC
   - trata energia, arranque persistente e ownership do ficheiro OAuth live do Codex

## Regra principal

O codigo novo deve ser escrito em `source/`.
O runtime em `runtime/` deve ser tratado como destino de build/publicacao, nao como lugar para desenvolver manualmente.

## Decisoes de scheduling ja fechadas

- os avisos por evento sao variaveis
- o default do sistema deve ser:
  - `24h antes`
  - `30 min antes`
- cada aviso pode ser:
  - relativo ao evento
  - ou por horario fixo
- os estados visiveis do envio devem ser:
  - `pending`
  - `waiting_confirmation`
  - `sent`
- quando a hora do evento passar, jobs concluidos devem ser limpos da semana ativa
- o cleanup deve arquivar eventos passados concluidos antes de os retirar da vista ativa
- um evento passado so sai da vista ativa quando todos os jobs estiverem concluidos, suprimidos ou desativados
- a organizacao canonica dos schedules deve ser por grupo
- dentro de cada grupo, o calendario canonico deve ser mensal
- a semana ISO continua obrigatoria como indice operacional
- a quinzena nao foi escolhida como fronteira canonica
- o watchdog deve detetar jobs que passaram `x` minutos da hora de envio sem chegar a `sent`
- o dashboard deve mostrar de forma explicita o estado do `watchdog` e do `host companion`

## Reforco Multi-Grupo

- os grupos atuais conhecidos sao apenas exemplos iniciais, nao um limite de produto
- o sistema deve tratar `group-directory` como catalogo escalavel, nao como lista curta hardcoded
- uma mensagem de uma pessoa especifica pode originar um plano de distribuicao para `N` grupos destino
- a unidade de idempotencia para distribuicao multi-grupo deve ser:
  - `mensagem origem + grupo destino`
- falhas num grupo nao devem bloquear a distribuicao para os restantes grupos

## Modelo de Ownership

- `app owner`
  - dono global da aplicacao
  - pode gerir settings globais, auth, host lifecycle, terminal e qualquer grupo
- `group owner`
  - dono operacional de um ou mais grupos especificos
  - pode gerir apenas agendamentos, routing e aprovacoes dentro dos grupos que lhe pertencem
- `group owner` nao recebe por defeito privilegios globais de `app owner`

## Niveis de Acesso do Calendario

- `group`
  - acesso normal do grupo ao proprio calendario
  - por defeito: `read`
  - leitura e interacao limitada ao contexto do grupo atual
- `group_owner`
  - gestao do calendario dos grupos que possui
  - por defeito: `read_write`
  - pode criar, editar, aprovar, suprimir e reprocessar apenas nesses grupos
- `app_owner`
  - acesso global a qualquer calendario do sistema
  - por defeito: `read_write`
  - pode sobrepor politicas locais quando necessario
- os modos de acesso canonicos sao apenas:
  - `read`
  - `read_write`

## Consola WhatsApp

- a UI operacional inclui uma pagina `WhatsApp`
- essa pagina deve concentrar:
  - estado da sessao/auth usada pelo bot
  - grupos WhatsApp conhecidos pelo sistema
  - conversas privadas/pessoas conhecidas com `whatsapp_jid`
  - permissoes efetivas por grupo e por pessoa
  - `app owners`, `group owners` e ACL do calendario por grupo
- o backend deve expor um snapshot unico de workspace WhatsApp para esta pagina, em vez de obrigar a UI a compor varios endpoints sem contexto

## Principios de UX do Frontend

- o frontend novo nao deve parecer uma consola administrativa antiga nem um painel tecnico cru
- o utilizador-alvo pode ter pouco conhecimento tecnico
- a interface deve privilegiar:
  - linguagem simples
  - estados humanos claros
  - passos guiados
  - feedback imediato
  - navegacao previsivel
- a UI nao deve obrigar o utilizador a interpretar:
  - `jid`
  - ids internos
  - nomes tecnicos de modulos
  - diferenca estrutural entre evento base, job, tentativa e sinal
  sem uma camada de traducao visual
- o frontend deve usar divulgacao progressiva:
  - por defeito mostra o essencial
  - detalhes tecnicos ficam atras de vistas secundarias, drawers ou modo avancado
- o ecran inicial deve responder de forma rapida a:
  - o WhatsApp esta ligado?
  - ha algo para fazer agora?
  - houve falhas?
  - qual e o proximo passo recomendado?
- criar ou editar entidades sensiveis deve acontecer por fluxos guiados:
  - criar aviso/agendamento
  - distribuir mensagem para multiplos grupos
  - configurar permissoes
  - ligar ou reparar WhatsApp
- o frontend deve parecer moderno e intencional:
  - layout limpo
  - hierarquia visual forte
  - contraste bom
  - tipografia legivel
  - componentes coerentes
  - sem aspeto "dated" de backoffice antigo

## Estrutura principal

- `docs/architecture/`
  - arquitetura conceptual e especificacao modular
- `docs/reuse/`
  - manifesto do codigo atual que foi copiado para reaproveitamento
- `docs/deployment/`
  - plano de runtime em `LXD`
- `source/`
  - monorepo workspace do projeto novo
- `legacy_healthy_code/`
  - referencia residual do projeto atual
  - `ready_to_port/` foi removido na `Wave 17` por ja estar supersedido
  - `reference_engines/` ficou como ultima referencia para comportamento de `alerts` e `automations`
- `runtime/lxd/`
  - layout preparado para publicar builds para um container `LXD`

## OAuth Codex

O caminho canonico no host deve ser:

- `/home/eliaspc/.codex/auth.json`

No runtime isolado, a aplicacao deve ver esse ficheiro em:

- `/codex/auth.json`

Se houver fontes secundarias/backup, devem ser montadas como fontes explicitas do `codex_auth_router`, nunca como substituicao silenciosa da fonte canonica.
O ponto importante e este: o projeto deve gerir o mesmo ficheiro live que o Codex usa, nao uma copia paralela escondida.

## Fluxo de build/deploy pretendido

1. Desenvolver e testar em `source/`.
2. Gerar artefactos para o core app e para o host companion.
3. Publicar o core app para `runtime/lxd/release-bundles/` ou `runtime/lxd/host-mounts/app-release/`.
4. Publicar o host companion para `runtime/host/`.
5. O container `LXD` consome apenas o artefacto publicado, nao o source tree inteiro como local de edicao.
6. Dados persistentes do runtime ficam separados do source.

Na `Wave 12`, o fluxo canónico passa por:

- `pnpm run validate:wave12`
- backend publicado em `runtime/lxd/host-mounts/app-release/current/`
- bundle versionado em `runtime/lxd/release-bundles/`
- host companion publicado em `runtime/host/current/`
- unit file do host em `runtime/host/systemd-user/lume-hub-host.service`

## Documentos mais importantes

- [AGENTS.md](/home/eliaspc/Documentos/lume-hub/AGENTS.md)
- [lume_hub_rewrite_master_prompt.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_rewrite_master_prompt.md)
- [lume_hub_modular_implementation_spec.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_modular_implementation_spec.md)
- [lume_hub_implementation_waves.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_implementation_waves.md)
- [lume_hub_gap_audit.md](/home/eliaspc/Documentos/lume-hub/docs/architecture/lume_hub_gap_audit.md)
- [lume_hub_lxd_runtime_plan.md](/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_lxd_runtime_plan.md)
- [lume_hub_release_publish.md](/home/eliaspc/Documentos/lume-hub/docs/deployment/lume_hub_release_publish.md)

## Estado atual

As `Wave 0` a `Wave 18` ja foram executadas e validadas.
Neste momento:

- o frontend operacional das `Wave 13` a `Wave 16` ficou fechado
- a `Wave 17` limpou stubs mortos, docs obsoletas e legado ja supersedido
- a `Wave 18` fechou a composition root e o runtime real de backend em memoria
- o backlog restante ficou agora em `Wave 19` a `Wave 24`
- essas waves focam:
  - HTTP/WS reais
  - WhatsApp live
  - providers LLM reais
  - API operacional completa
  - hardening e cutover
  - limpeza final da ronda
- regra de processo:
  - qualquer nova ronda de waves deve terminar com uma wave final de limpeza do repositorio
- o objetivo explicito desta nova ronda e chegar a runtime `Live` funcional como substituicao do sistema anterior
