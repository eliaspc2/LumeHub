# Lume Hub Release Publish Guide

Guia canonico para gerar e publicar os artefactos do `Lume Hub`.

## Comando principal

No source tree:

```bash
PATH=/opt/node-v20-current/bin:$PATH /opt/node-v20-current/bin/corepack pnpm run validate:release
```

Este comando faz:

1. build do workspace
2. validacao local da release em sandbox
3. publicacao da release atual no `runtime/`

## Backend publicado

Artefactos locais gerados:

- `runtime/lxd/release-bundles/lume-hub-backend-<release-id>.tar.gz`
- `runtime/lxd/host-mounts/app-release/current/`
- `runtime/lxd/host-mounts/app-release/current/bin/lume-hub-backend`
- `runtime/lxd/host-mounts/app-release/current/systemd/lume-hub-backend.service`
- `runtime/lxd/host-mounts/app-release/current/release-manifest.json`

Mounts canonicos do backend:

- auth read-only:
  - `/home/eliaspc/.codex/auth.json` -> `/codex/auth.json`
- data read-write:
  - `runtime/lxd/host-mounts/data` -> `/srv/lume-hub/data`
- logs read-write:
  - `runtime/lxd/host-mounts/logs` -> `/srv/lume-hub/logs`
- app release:
  - `runtime/lxd/host-mounts/app-release` -> `/srv/lume-hub/app`

Entry point dentro do container:

- `/srv/lume-hub/app/current/bin/lume-hub-backend`

## Host companion publicado

Artefactos locais gerados:

- `runtime/host/releases/lume-hub-host-<release-id>.tar.gz`
- `runtime/host/current/`
- `runtime/host/current/bin/lume-hub-host`
- `runtime/host/current/release-manifest.json`
- `runtime/host/systemd-user/lume-hub-host.service`

Entry point no host:

- `/home/eliaspc/Documentos/lume-hub/runtime/host/current/bin/lume-hub-host`

Unit file de utilizador:

- `/home/eliaspc/Documentos/lume-hub/runtime/host/systemd-user/lume-hub-host.service`

## Publicacao final recomendada

1. Gerar a release com `pnpm run validate:release`.
2. Montar `runtime/lxd/host-mounts/app-release` em `/srv/lume-hub/app`.
3. Montar `runtime/lxd/host-mounts/data` em `/srv/lume-hub/data`.
4. Montar `runtime/lxd/host-mounts/logs` em `/srv/lume-hub/logs`.
5. Montar `/home/eliaspc/.codex/auth.json` em `/codex/auth.json` como read-only.
6. Arrancar o backend no container com `/srv/lume-hub/app/current/bin/lume-hub-backend`.
7. No host, ativar a unit com:

```bash
systemctl --user daemon-reload
systemctl --user enable --now lume-hub-host.service
```

## Notas

- a release publicada nao deve ser editada manualmente
- qualquer alteracao volta a acontecer em `source/` e volta a ser publicada
- `data/`, `logs/` e `auth.json` ficam fora do bundle da app
