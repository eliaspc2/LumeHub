# LXD Runtime Workspace

Esta pasta prepara o runtime futuro em `LXD`.
Se mais tarde o runtime mudar para `Incus`, o modelo de publicacao continua a ser o mesmo.
O desenho ideal deste projeto inclui um `host companion` fora do container.

## Pastas

- `host-mounts/app-release/`
  - destino de build publicado para ser montado no container
- `host-mounts/data/`
  - dados persistentes da aplicacao
- `host-mounts/data/groups/`
  - workspaces por grupo com calendario mensal canonico
- `host-mounts/data/runtime/`
  - queue, watchdog e estado auxiliar
- `host-mounts/logs/`
  - logs persistentes
- `release-bundles/`
  - bundles versionados prontos a publicar
- `profiles/`
  - perfis `LXD` quando o runtime for implementado
- `cloud-init/`
  - cloud-init ou scripts de bootstrap do container

## Fluxo operacional esperado

1. o source tree gera build
2. o build vai para `release-bundles/` ou `host-mounts/app-release/`
3. o container arranca a partir do artefacto publicado
4. `data/` e `logs/` ficam montados como persistencia separada

## OAuth

O ficheiro do host:

- `/home/eliaspc/.codex/auth.json`

deve ser montado no container em:

- `/codex/auth.json`

Este e o mesmo ficheiro live usado pelo Codex.
Idealmente, quem o gere e o `lume-hub-host` no host, nao o backend dentro do container.

## Regra de ouro

Nao editar o codigo publicado aqui manualmente.
Se houver uma alteracao, ela deve acontecer em `source/` e voltar a ser publicada.
