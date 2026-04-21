# LumeHub Commercial Delivery Kit

Este e o pacote honesto para entregar o `LumeHub` como solucao comercial sem prometer mais do que a arquitetura atual garante.

## Promessa correta

O `LumeHub` pode ser entregue como:

- backend publicado como artefacto para runtime containerizado
- `host companion` publicado separadamente para correr no PC anfitriao
- dados, logs e auth fora do bundle aplicacional
- runbooks curtos para instalar, atualizar, validar saude e recuperar auth/token

O `LumeHub` nao deve ser vendido como `um container unico` enquanto o `host companion` continuar obrigatorio para energia, autostart e ownership do OAuth Codex.

## Artefactos entregaveis

Gerar a release a partir de `/home/eliaspc/Documentos/lume-hub/source`:

```bash
PATH=/opt/node-v20-current/bin:$PATH /opt/node-v20-current/bin/corepack pnpm run validate:release
```

Artefactos do backend:

- `runtime/lxd/release-bundles/lume-hub-backend-<release-id>.tar.gz`
- `runtime/lxd/host-mounts/app-release/current/`
- `runtime/lxd/host-mounts/app-release/current/bin/lume-hub-backend`
- `runtime/lxd/host-mounts/app-release/current/release-manifest.json`

Artefactos do host companion:

- `runtime/host/releases/lume-hub-host-<release-id>.tar.gz`
- `runtime/host/current/`
- `runtime/host/current/bin/lume-hub-host`
- `runtime/host/current/release-manifest.json`
- `runtime/host/systemd-user/lume-hub-host.service`

## Montagens canonicas

Backend dentro do runtime containerizado:

- app: `runtime/lxd/host-mounts/app-release` -> `/srv/lume-hub/app`
- data: `runtime/lxd/host-mounts/data` -> `/srv/lume-hub/data`
- logs: `runtime/lxd/host-mounts/logs` -> `/srv/lume-hub/logs`
- auth: `/home/eliaspc/.codex/auth.json` -> `/codex/auth.json` como read-only

Host companion no PC anfitriao:

- app: `runtime/host/current`
- state: `runtime/host/state`
- systemd user unit: `runtime/host/systemd-user/lume-hub-host.service`
- auth canonica: `/home/eliaspc/.codex/auth.json`
- bridge para backend: `runtime/lxd/host-mounts/data/runtime/host-state.json`

## Install curto

1. Gerar a release com `pnpm run validate:release`.
2. Entregar o tarball do backend ou a pasta `runtime/lxd/host-mounts/app-release/current/`.
3. Montar `app-release`, `data`, `logs` e `auth` nos caminhos canonicos do runtime containerizado.
4. Arrancar o backend com `/srv/lume-hub/app/current/bin/lume-hub-backend`.
5. Entregar o tarball do host companion ou a pasta `runtime/host/current/` no PC anfitriao.
6. Ativar o host companion no PC anfitriao:

```bash
systemctl --user daemon-reload
systemctl --user enable --now lume-hub-host.service
```

7. Abrir o frontend do backend e confirmar `Hoje`, `WhatsApp`, `LumeHub` e `Codex Router`.

## Update curto

1. Gerar nova release com `pnpm run validate:release`.
2. Parar backend e host companion.
3. Substituir apenas `runtime/lxd/host-mounts/app-release/current/` e `runtime/host/current/`.
4. Nao apagar `runtime/lxd/host-mounts/data`, `runtime/lxd/host-mounts/logs`, `runtime/host/state` nem `/home/eliaspc/.codex/auth.json`.
5. Reiniciar os servicos.
6. Confirmar health check.

## Health check curto

No backend:

```bash
curl -fsS http://127.0.0.1:18420/api/runtime/diagnostics
```

Sinais esperados:

- `phase` igual a `running`
- `readiness.status` igual a `healthy`
- `health.status` igual a `healthy`
- modulo `codex-auth-router` saudavel
- modulo `host-lifecycle` saudavel
- WhatsApp em `open` quando a sessao ja estiver emparelhada

No host:

```bash
systemctl --user --no-pager --full status lume-hub-host.service
```

Sinais esperados:

- servico `active (running)`
- heartbeat recente em `runtime/lxd/host-mounts/data/runtime/host-state.json`
- sem erro recente em `runtime/host/state/host-runtime-state.json`

## Recovery de token/auth

1. Nao editar o bundle do backend para corrigir auth.
2. Confirmar se `/home/eliaspc/.codex/auth.json` existe e continua a ser o ficheiro live do Codex.
3. Abrir a pagina `Codex Router` no LumeHub.
4. Confirmar se a troca de token esta ligada.
5. Usar `Escolher melhor token` quando houver mais do que um token disponivel.
6. Se for preciso fixar uma conta, abrir `Ver todos os tokens e escolher manualmente`.
7. Antes de qualquer troca, o router deve preservar backup da auth canonica atual.
8. Se o token canonico estiver corrompido, recuperar primeiro a partir dos backups do router ou do repositorio privado de backups antes de voltar a ligar a troca automatica.

## Resposta comercial simples

Se perguntarem "posso entregar o container + instrucoes?", a resposta correta e:

> Podes entregar o backend preparado para container com instrucoes e mounts canonicos, mas deves entregar tambem o `host companion` fora do container. Hoje isto nao e um produto de container unico, porque o PC anfitriao ainda gere energia, autostart e OAuth Codex.

