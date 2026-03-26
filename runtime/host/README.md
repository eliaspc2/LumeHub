# Host Runtime

Runtime local para o `lume-hub-host`.

## Objetivo

Guardar e preparar o lado host do projeto, separado do source tree e separado do runtime containerizado.

## Pastas

- `current/`
  - release ativa publicada do host companion
- `releases/`
  - bundles versionados do host companion
- `systemd-user/`
  - manifests/unidades de utilizador
- `state/`
  - estado local do host companion
  - `host-runtime-state.json`
    - estado local do companion no host
  - `power-policy-state.json`
    - politica anti-sleep persistida
  - `sleep-inhibitor.json`
    - descritor observavel do inhibitor ativo

## Responsabilidades

- arranque persistente no proprio PC
- politica de energia/deep sleep
- ownership do mesmo ficheiro OAuth live usado pelo Codex
- publicar heartbeat para `runtime/lxd/host-mounts/data/runtime/host-state.json`

## Artefactos da Wave 12

- `current/bin/lume-hub-host`
  - entrypoint publicado para o host
- `current/release-manifest.json`
  - manifest com paths de estado local e do backend bridge
- `systemd-user/lume-hub-host.service`
  - unit file gerada para `systemd --user`
