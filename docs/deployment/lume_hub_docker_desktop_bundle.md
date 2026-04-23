# LumeHub Docker Desktop Bundle

Guia curto para empacotar e entregar o `LumeHub` como bundle portatil para `Windows`, `macOS` ou `Linux` com `Docker Desktop` ou outro runtime compativel com `docker compose`.

## Objetivo

Este bundle fecha um caminho simples de entrega:

- uma pasta pronta a extrair
- `compose.yaml`
- `Dockerfile`
- scripts `.cmd` para Windows
- scripts `.sh` para Linux/macOS
- volumes locais para `auth`, `data`, `logs` e `state`

O bundle inclui:

- backend publicado
- `host companion` embebido dentro do mesmo container
- frontend web ja incluido

## Comando de empacotamento

No source tree:

```bash
PATH=/opt/node-v20-current/bin:$PATH /opt/node-v20-current/bin/corepack pnpm run package:docker-desktop
```

Saidas geradas:

- `runtime/portable-bundles/lume-hub-docker-desktop-<release-id>/`
- `runtime/portable-bundles/lume-hub-docker-desktop-<release-id>.zip`
- `runtime/portable-bundles/lume-hub-docker-desktop-<release-id>.tar.gz`

## Estrutura do bundle

- `compose.yaml`
- `Dockerfile`
- `.env.example`
- `README.md`
- `scripts/start-lumehub.cmd`
- `scripts/stop-lumehub.cmd`
- `scripts/show-logs.cmd`
- `scripts/start-lumehub.sh`
- `scripts/stop-lumehub.sh`
- `scripts/show-logs.sh`
- `auth/`
- `data/`
- `logs/`
- `state/`
- `runtime/lxd/host-mounts/app-release/current/`
- `runtime/host/current/`

## Caminho recomendado em Windows

1. Instalar `Docker Desktop`.
2. Extrair o zip para uma pasta normal, por exemplo `C:\LumeHub`.
3. Escolher uma opçao de credenciais:
   - `Codex OAuth`: meter `auth.json` em `auth\`.
   - `OpenAI compat`: preencher `OPENAI_API_KEY` em `.env`.
4. Correr `scripts\start-lumehub.cmd`.
5. Abrir `http://localhost:18420/today`.

## Limitacoes honestas

- Este bundle facilita muito a entrega comercial, mas nao transforma o produto em controlo total do `host OS`.
- O companion embebido resolve heartbeat, sync-back de auth e estado interno da app.
- O bundle nao instala autostart no Windows nem impede `sleep` do sistema anfitriao fora do container.
- O emparelhamento `WhatsApp` e local a esse ambiente novo; normalmente sera preciso ler o QR no primeiro arranque.
