# Runtime

Esta pasta existe para separar runtime de codigo-fonte.

## Regra

- desenvolver em `../source`
- publicar para `./lxd`
- tratar `./host/current/` e `./lxd/host-mounts/app-release/current/` como runtime ativo
- tratar `./host/releases/`, `./lxd/release-bundles/` e `./portable-bundles/` como artefactos gerados, nao como codigo-fonte

## Subpastas principais

- [lxd/README.md](/home/eliaspc/Documentos/Git/lume-hub/runtime/lxd/README.md)
- `host/`
  - companion local para integracao com o proprio PC
  - release publicada em `host/current/`
- `portable-bundles/`
  - bundles de entrega gerados para Docker Desktop / packaging

## Housekeeping

- para limpar artefactos antigos sem tocar no runtime atual:
  - `corepack pnpm --dir /home/eliaspc/Documentos/Git/lume-hub/source run clean:runtime`
- para aplicar a limpeza:
  - `corepack pnpm --dir /home/eliaspc/Documentos/Git/lume-hub/source run clean:runtime -- --apply`
- politica atual:
  - manter o `releaseId` live em `host/current/` e `lxd/host-mounts/app-release/current/`
  - manter apenas o bundle portatil mais recente
  - apagar arquivos historicos redundantes fora desses alvos
