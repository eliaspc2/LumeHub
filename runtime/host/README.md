# Host Runtime

Runtime local para o `lume-hub-host`.

## Objetivo

Guardar e preparar o lado host do projeto, separado do source tree e separado do runtime containerizado.

## Pastas

- `systemd-user/`
  - manifests/unidades de utilizador
- `state/`
  - estado local do host companion

## Responsabilidades

- arranque persistente no proprio PC
- politica de energia/deep sleep
- ownership do mesmo ficheiro OAuth live usado pelo Codex
