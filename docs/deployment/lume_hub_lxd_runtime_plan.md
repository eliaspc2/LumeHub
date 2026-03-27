# Lume Hub LXD Runtime Plan

Este projeto foi preparado para correr em `LXD`, mas sem misturar codigo-fonte com runtime.
Se no futuro o utilizador preferir `Incus` ou outro runtime semelhante, esta separacao continua a ser valida.
O desenho ideal passa a assumir um core app isolado e um host companion no proprio PC.

## Estado atual do host

Neste host, `lxd` foi removido anteriormente por decisao operacional.
Por isso, este projeto prepara:

- layout em disco
- convencoes
- caminhos canonicos
- fluxo de build/publicacao

Mas nao reinstala nem assume `LXD` ativo sem pedido explicito.

## Principio central

O container nao e o local de desenvolvimento.
O container e apenas o local de execucao.

## Dois deployables

1. core app
   - pode correr em `LXD`
2. host companion
   - corre no proprio PC
   - gere:
     - persistencia de arranque
     - politica de deep sleep
     - o mesmo ficheiro OAuth live usado pelo Codex

## Caminhos canonicos no host

- source tree:
  - `/home/eliaspc/Documentos/lume-hub/source`
- docs do projeto:
  - `/home/eliaspc/Documentos/lume-hub/docs`
- staging para artefactos:
  - `/home/eliaspc/Documentos/lume-hub/runtime/lxd/release-bundles`
- staging para bind mounts:
  - `/home/eliaspc/Documentos/lume-hub/runtime/lxd/host-mounts/app-release`
  - `/home/eliaspc/Documentos/lume-hub/runtime/lxd/host-mounts/data`
  - `/home/eliaspc/Documentos/lume-hub/runtime/lxd/host-mounts/logs`
- auth OAuth canonica no host:
  - `/home/eliaspc/.codex/auth.json`

## Caminhos canonicos dentro do container

- aplicacao publicada:
  - `/srv/lume-hub/app`
- dados persistentes:
  - `/srv/lume-hub/data`
- logs:
  - `/srv/lume-hub/logs`
- auth OAuth canonica:
  - `/codex/auth.json`

## Caminhos canonicos no host companion

- runtime host:
  - `/home/eliaspc/Documentos/lume-hub/runtime/host`
- estado local:
  - `/home/eliaspc/Documentos/lume-hub/runtime/host/state`
- manifests de `systemd --user`:
  - `/home/eliaspc/Documentos/lume-hub/runtime/host/systemd-user`

## Fluxo ideal

1. desenvolver em `source/`
2. correr testes e typecheck em `source/`
3. gerar um build imutavel para o core app
4. gerar o build/install payload do host companion
5. publicar o core app para:
   - `runtime/lxd/release-bundles/`
   - ou `runtime/lxd/host-mounts/app-release/`
6. publicar o host companion para `runtime/host/`
7. o container usa apenas o artefacto publicado
8. dados e logs vivem fora do bundle

## Layout de dados esperado no runtime

- `host-mounts/data/groups/`
  - pastas por grupo
  - cada grupo com `group.json`, `prompt.md`, `policy.json` e `calendar/YYYY-MM.json`
- `host-mounts/data/runtime/`
  - queue, watchdog e estado auxiliar

## Montagens recomendadas

Montagens read-only:

- `/home/eliaspc/.codex/auth.json` -> `/codex/auth.json`

Montagens read-write:

- `runtime/lxd/host-mounts/data` -> `/srv/lume-hub/data`
- `runtime/lxd/host-mounts/logs` -> `/srv/lume-hub/logs`

Montagem opcional de release:

- `runtime/lxd/host-mounts/app-release` -> `/srv/lume-hub/app`

Nota:

- idealmente, a troca do ficheiro OAuth live e feita pelo `lume-hub-host` no host
- o container recebe esse mesmo ficheiro live apenas por mount controlado

## O que nao fazer

- nao editar codigo dentro do container
- nao usar o container como repositorio de trabalho
- nao guardar estado de negocio dentro do source tree
- nao esconder `auth.json` dentro do bundle da app

## Sequencia futura quando o utilizador quiser mesmo `LXD`

1. validar se `LXD` deve voltar a existir neste host
2. instalar/configurar `LXD` apenas com aprovacao explicita
3. criar profile e cloud-init em `runtime/lxd/profiles/` e `runtime/lxd/cloud-init/`
4. criar instance dedicada para `lume-hub`
5. instalar/configurar o `lume-hub-host` no proprio PC
6. publicar bundle do core app
7. montar auth/dados/logs
8. arrancar o servico no container

## Resultado pretendido

O projeto fica com:

- source limpo e independente
- runtime substituivel
- deploy repetivel
- auth e dados desacoplados do bundle
