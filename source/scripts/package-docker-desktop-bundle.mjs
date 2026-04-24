import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { packageRelease } from './package-release.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SOURCE_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');
const OUTPUT_ROOT = resolve(REPO_ROOT, 'runtime', 'portable-bundles');

async function main() {
  const generatedAt = new Date();
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-docker-desktop-'));

  try {
    const release = await packageRelease({
      repoRoot: REPO_ROOT,
      sourceRoot: SOURCE_ROOT,
      runtimeRoot: resolve(sandboxPath, 'runtime'),
      generatedAt,
    });
    const bundleName = `lume-hub-docker-desktop-${release.releaseId}`;
    const bundleRoot = resolve(OUTPUT_ROOT, bundleName);

    await resetDirectory(bundleRoot);
    await mkdir(OUTPUT_ROOT, { recursive: true });

    await cp(release.backend.stagePath, resolve(bundleRoot, 'runtime', 'lxd', 'host-mounts', 'app-release', 'current'), {
      recursive: true,
    });
    await cp(release.host.stagePath, resolve(bundleRoot, 'runtime', 'host', 'current'), {
      recursive: true,
    });
    await cp(
      resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'dist'),
      resolve(bundleRoot, 'source', 'apps', 'lume-hub-web', 'dist'),
      { recursive: true },
    );
    await cp(
      resolve(SOURCE_ROOT, 'apps', 'lume-hub-host', 'dist'),
      resolve(bundleRoot, 'source', 'apps', 'lume-hub-host', 'dist'),
      { recursive: true },
    );
    await cp(
      resolve(REPO_ROOT, 'runtime', 'lxd', 'host-mounts', 'data', 'groups', 'README.md'),
      resolve(bundleRoot, 'data', 'groups', 'README.md'),
    );

    await ensureWritableStateLayout(bundleRoot);
    await writeBundleFiles(bundleRoot, release);

    const zipFilePath = resolve(OUTPUT_ROOT, `${bundleName}.zip`);
    const tarFilePath = resolve(OUTPUT_ROOT, `${bundleName}.tar.gz`);
    await createZipArchive(bundleRoot, zipFilePath);
    await createTarArchive(bundleRoot, tarFilePath);

    const result = {
      releaseId: release.releaseId,
      generatedAt: generatedAt.toISOString(),
      bundleRoot,
      zipFilePath,
      tarFilePath,
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
}

async function ensureWritableStateLayout(bundleRoot) {
  for (const directoryPath of [
    resolve(bundleRoot, 'auth'),
    resolve(bundleRoot, 'data', 'config'),
    resolve(bundleRoot, 'data', 'groups'),
    resolve(bundleRoot, 'data', 'runtime'),
    resolve(bundleRoot, 'logs'),
    resolve(bundleRoot, 'state'),
    resolve(bundleRoot, 'scripts'),
    resolve(bundleRoot, 'docker'),
  ]) {
    await mkdir(directoryPath, { recursive: true });
  }

  await writeFile(
    resolve(bundleRoot, 'auth', 'README.md'),
    [
      '# Auth',
      '',
      '- Para usar `Codex OAuth`, coloca aqui o ficheiro `auth.json`.',
      '- Caminho esperado pelo container: `/codex/auth.json`.',
      '- Se preferires arrancar primeiro com `OpenAI API key`, deixa esta pasta vazia e define `OPENAI_API_KEY` no `.env`.',
      '',
    ].join('\n'),
    'utf8',
  );

  await writeFile(resolve(bundleRoot, 'data', 'config', '.gitkeep'), '', 'utf8');
  await writeFile(resolve(bundleRoot, 'data', 'runtime', '.gitkeep'), '', 'utf8');
  await writeFile(resolve(bundleRoot, 'logs', '.gitkeep'), '', 'utf8');
  await writeFile(resolve(bundleRoot, 'state', '.gitkeep'), '', 'utf8');
}

async function writeBundleFiles(bundleRoot, release) {
  const releaseId = release.releaseId;
  const bundleName = `lume-hub-docker-desktop-${releaseId}`;

  await writeFile(resolve(bundleRoot, '.dockerignore'), buildDockerIgnore(), 'utf8');
  await writeFile(resolve(bundleRoot, 'Dockerfile'), buildDockerfile(), 'utf8');
  await writeFile(resolve(bundleRoot, 'compose.yaml'), buildComposeYaml(releaseId), 'utf8');
  await writeFile(resolve(bundleRoot, '.env.example'), buildEnvExample(releaseId), 'utf8');
  await writeFile(resolve(bundleRoot, 'docker', 'start-container.sh'), buildContainerStartScript(), 'utf8');
  await writeFile(resolve(bundleRoot, 'scripts', 'start-lumehub.cmd'), buildWindowsStartScript(), 'utf8');
  await writeFile(resolve(bundleRoot, 'scripts', 'stop-lumehub.cmd'), buildWindowsStopScript(), 'utf8');
  await writeFile(resolve(bundleRoot, 'scripts', 'show-logs.cmd'), buildWindowsLogsScript(), 'utf8');
  await writeFile(resolve(bundleRoot, 'scripts', 'start-lumehub.sh'), buildPosixStartScript(), 'utf8');
  await writeFile(resolve(bundleRoot, 'scripts', 'stop-lumehub.sh'), buildPosixStopScript(), 'utf8');
  await writeFile(resolve(bundleRoot, 'scripts', 'show-logs.sh'), buildPosixLogsScript(), 'utf8');
  await writeFile(resolve(bundleRoot, 'README.md'), buildBundleReadme(bundleName, releaseId), 'utf8');
  await writeJson(resolve(bundleRoot, 'portable-manifest.json'), {
    schemaVersion: 1,
    bundleKind: 'docker_desktop_portable',
    releaseId,
    generatedAt: release.generatedAt,
    container: {
      serviceName: 'lumehub',
      httpPort: 18420,
      composeFile: 'compose.yaml',
      imageName: `lume-hub-docker-desktop:${releaseId}`,
      embeddedHostCompanion: true,
    },
    mounts: {
      auth: './auth -> /codex',
      data: './data -> /srv/lume-hub/runtime/lxd/host-mounts/data',
      logs: './logs -> /srv/lume-hub/runtime/lxd/host-mounts/logs',
      state: './state -> /srv/lume-hub/runtime/host/state',
    },
    honestLimit:
      'Este bundle simplifica a entrega em Docker Desktop e corre em Windows/macOS/Linux, mas nao gere energia/autostart do sistema operativo anfitriao fora do container.',
  });
}

function buildDockerIgnore() {
  return [
    'auth',
    'data',
    'logs',
    'state',
    '*.zip',
    '*.tar.gz',
    '',
  ].join('\n');
}

function buildDockerfile() {
  return [
    'FROM node:20-bookworm-slim',
    '',
    'WORKDIR /srv/lume-hub',
    'ENV NODE_ENV=production',
    'ENV CODEX_AUTH_FILE=/codex/auth.json',
    'ENV LUME_HUB_CODEX_AUTH_FILE=/codex/auth.json',
    'ENV LUME_HUB_DATA_DIR=/srv/lume-hub/runtime/lxd/host-mounts/data',
    'ENV LUME_HUB_CONFIG_DIR=/srv/lume-hub/runtime/lxd/host-mounts/data/config',
    'ENV LUME_HUB_RUNTIME_DIR=/srv/lume-hub/runtime/lxd/host-mounts/data/runtime',
    'ENV LUME_HUB_WEB_DIST_ROOT=/srv/lume-hub/source/apps/lume-hub-web/dist',
    'ENV LUME_HUB_POWER_STATE_FILE=/srv/lume-hub/runtime/host/state/power-policy-state.json',
    'ENV LUME_HUB_INHIBITOR_STATE_FILE=/srv/lume-hub/runtime/host/state/sleep-inhibitor.json',
    'ENV LUME_HUB_HOST_STATE_FILE=/srv/lume-hub/runtime/host/state/host-runtime-state.json',
    'ENV LUME_HUB_BACKEND_STATE_FILE=/srv/lume-hub/runtime/lxd/host-mounts/data/runtime/host-state.json',
    'ENV LUME_HUB_HTTP_HOST=0.0.0.0',
    'ENV LUME_HUB_HTTP_PORT=18420',
    'ENV LUME_HUB_CONVERSATION_MAX_INBOUND_AGE_MS=86400000',
    '',
    'COPY runtime /srv/lume-hub/runtime',
    'COPY source/apps/lume-hub-web/dist /srv/lume-hub/source/apps/lume-hub-web/dist',
    'COPY source/apps/lume-hub-host/dist /srv/lume-hub/source/apps/lume-hub-host/dist',
    'COPY docker/start-container.sh /usr/local/bin/lume-hub-container-start',
    '',
    'RUN chmod +x /usr/local/bin/lume-hub-container-start \\',
    '  && mkdir -p /codex \\',
    '  && mkdir -p /srv/lume-hub/runtime/lxd/host-mounts/data/config \\',
    '  && mkdir -p /srv/lume-hub/runtime/lxd/host-mounts/data/groups \\',
    '  && mkdir -p /srv/lume-hub/runtime/lxd/host-mounts/data/runtime \\',
    '  && mkdir -p /srv/lume-hub/runtime/lxd/host-mounts/logs \\',
    '  && mkdir -p /srv/lume-hub/runtime/host/state',
    '',
    'EXPOSE 18420',
    'ENTRYPOINT ["/usr/local/bin/lume-hub-container-start"]',
    '',
  ].join('\n');
}

function buildComposeYaml(releaseId) {
  return [
    'services:',
    '  lumehub:',
    '    build:',
    '      context: .',
    '      dockerfile: Dockerfile',
    `    image: lume-hub-docker-desktop:${releaseId}`,
    '    container_name: ${LUME_HUB_CONTAINER_NAME:-lumehub}',
    '    restart: unless-stopped',
    '    ports:',
    '      - "${LUME_HUB_PORT:-18420}:18420"',
    '    environment:',
    '      TZ: ${TZ:-Europe/Lisbon}',
    '      CODEX_AUTH_FILE: /codex/auth.json',
    '      LUME_HUB_CODEX_AUTH_FILE: /codex/auth.json',
    '      LUME_HUB_HTTP_HOST: 0.0.0.0',
    '      LUME_HUB_HTTP_PORT: 18420',
    '      LUME_HUB_CONVERSATION_MAX_INBOUND_AGE_MS: ${LUME_HUB_CONVERSATION_MAX_INBOUND_AGE_MS:-86400000}',
    '      LUME_HUB_DATA_DIR: /srv/lume-hub/runtime/lxd/host-mounts/data',
    '      LUME_HUB_CONFIG_DIR: /srv/lume-hub/runtime/lxd/host-mounts/data/config',
    '      LUME_HUB_RUNTIME_DIR: /srv/lume-hub/runtime/lxd/host-mounts/data/runtime',
    '      LUME_HUB_WEB_DIST_ROOT: /srv/lume-hub/source/apps/lume-hub-web/dist',
    '      LUME_HUB_POWER_STATE_FILE: /srv/lume-hub/runtime/host/state/power-policy-state.json',
    '      LUME_HUB_INHIBITOR_STATE_FILE: /srv/lume-hub/runtime/host/state/sleep-inhibitor.json',
    '      LUME_HUB_HOST_STATE_FILE: /srv/lume-hub/runtime/host/state/host-runtime-state.json',
    '      LUME_HUB_BACKEND_STATE_FILE: /srv/lume-hub/runtime/lxd/host-mounts/data/runtime/host-state.json',
    '      LUME_HUB_EMBED_HOST_COMPANION: ${LUME_HUB_EMBED_HOST_COMPANION:-1}',
    '      OPENAI_API_KEY: ${OPENAI_API_KEY:-}',
    '      LUME_HUB_OPENAI_API_KEY: ${OPENAI_API_KEY:-}',
    '    volumes:',
    '      - ./auth:/codex',
    '      - ./data:/srv/lume-hub/runtime/lxd/host-mounts/data',
    '      - ./logs:/srv/lume-hub/runtime/lxd/host-mounts/logs',
    '      - ./state:/srv/lume-hub/runtime/host/state',
    '    healthcheck:',
    `      test: ["CMD-SHELL", "node -e \\"fetch('http://127.0.0.1:18420/api/runtime/diagnostics').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))\\""]`,
    '      interval: 30s',
    '      timeout: 5s',
    '      retries: 10',
    '      start_period: 20s',
    '',
  ].join('\n');
}

function buildEnvExample(releaseId) {
  return [
    `LUME_HUB_RELEASE_ID=${releaseId}`,
    'LUME_HUB_CONTAINER_NAME=lumehub',
    'LUME_HUB_PORT=18420',
    'TZ=Europe/Lisbon',
    'LUME_HUB_EMBED_HOST_COMPANION=1',
    'LUME_HUB_CONVERSATION_MAX_INBOUND_AGE_MS=86400000',
    '',
    '# Opcao A: usar Codex OAuth',
    '# Coloca o ficheiro auth.json dentro da pasta ./auth',
    '',
    '# Opcao B: usar OpenAI compat',
    'OPENAI_API_KEY=',
    '',
  ].join('\n');
}

function buildContainerStartScript() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'RUNTIME_ROOT="/srv/lume-hub/runtime"',
    'DATA_ROOT="${LUME_HUB_DATA_DIR:-$RUNTIME_ROOT/lxd/host-mounts/data}"',
    'RUNTIME_DATA_ROOT="${LUME_HUB_RUNTIME_DIR:-$DATA_ROOT/runtime}"',
    'HOST_STATE_ROOT="/srv/lume-hub/runtime/host/state"',
    'AUTH_FILE="${CODEX_AUTH_FILE:-/codex/auth.json}"',
    'SETTINGS_FILE="$RUNTIME_DATA_ROOT/system-settings.json"',
    'BACKEND_ENTRYPOINT="$RUNTIME_ROOT/lxd/host-mounts/app-release/current/bin/lume-hub-backend"',
    'HOST_ENTRYPOINT="$RUNTIME_ROOT/host/current/bin/lume-hub-host"',
    'PIDS=()',
    '',
    'mkdir -p "$DATA_ROOT/config" "$DATA_ROOT/groups" "$RUNTIME_DATA_ROOT" "$RUNTIME_ROOT/lxd/host-mounts/logs" "$HOST_STATE_ROOT" "$(dirname "$AUTH_FILE")"',
    '',
    'if [[ ! -f "$AUTH_FILE" ]]; then',
    '  echo "[LumeHub] Sem auth Codex em $AUTH_FILE."',
    '  if [[ -n "${LUME_HUB_OPENAI_API_KEY:-${OPENAI_API_KEY:-}}" && ! -f "$SETTINGS_FILE" ]]; then',
    "    cat > \"$SETTINGS_FILE\" <<'JSON'",
    '{',
    '  "schemaVersion": 1,',
    '  "commands": {',
    '    "assistantEnabled": true,',
    '    "schedulingEnabled": true,',
    '    "ownerTerminalEnabled": true,',
    '    "autoReplyEnabled": false,',
    '    "directRepliesEnabled": false,',
    '    "allowPrivateAssistant": true,',
    '    "authorizedGroupJids": [],',
    '    "authorizedPrivateJids": []',
    '  },',
    '  "whatsapp": {',
    '    "enabled": true,',
    '    "sharedAuthWithCodex": false,',
    '    "groupDiscoveryEnabled": true,',
    '    "conversationDiscoveryEnabled": true',
    '  },',
    '  "llm": {',
    '    "enabled": true,',
    '    "provider": "openai-compat",',
    '    "model": "gpt-5.4",',
    '    "streamingEnabled": true',
    '  },',
    '  "alerts": {',
    '    "enabled": true,',
    '    "rules": []',
    '  },',
    '  "automations": {',
    '    "enabled": true,',
    '    "fireWindowMinutes": 5,',
    '    "definitions": []',
    '  },',
    '  "ui": {',
    '    "defaultNotificationRules": [',
    '      {',
    '        "kind": "relative_before_event",',
    '        "daysBeforeEvent": 1,',
    '        "offsetMinutesBeforeEvent": 0,',
    '        "enabled": true,',
    '        "label": "24h antes"',
    '      },',
    '      {',
    '        "kind": "relative_before_event",',
    '        "daysBeforeEvent": 0,',
    '        "offsetMinutesBeforeEvent": 30,',
    '        "enabled": true,',
    '        "label": "30 min antes"',
    '      }',
    '    ]',
    '  },',
    '  "updatedAt": null',
    '}',
    'JSON',
    '    echo "[LumeHub] Criado system-settings.json minimo com OpenAI compat."',
    '  else',
    '    echo "[LumeHub] Podes colocar auth.json em ./auth ou definir OPENAI_API_KEY no .env."',
    '  fi',
    'fi',
    '',
    'terminate_children() {',
    '  local exit_code="${1:-0}"',
    '  trap - EXIT INT TERM',
    '  for pid in "${PIDS[@]}"; do',
    '    if kill -0 "$pid" 2>/dev/null; then',
    '      kill "$pid" 2>/dev/null || true',
    '    fi',
    '  done',
    '  wait "${PIDS[@]}" 2>/dev/null || true',
    '  exit "$exit_code"',
    '}',
    '',
    'trap \'terminate_children 0\' EXIT',
    'trap \'terminate_children 130\' INT TERM',
    '',
    'if [[ "${LUME_HUB_EMBED_HOST_COMPANION:-1}" != "0" ]]; then',
    '  "$HOST_ENTRYPOINT" &',
    '  PIDS+=("$!")',
    'fi',
    '',
    '"$BACKEND_ENTRYPOINT" &',
    'PIDS+=("$!")',
    '',
    'wait -n "${PIDS[@]}"',
    'exit_code=$?',
    'terminate_children "$exit_code"',
    '',
  ].join('\n');
}

function buildWindowsStartScript() {
  return [
    '@echo off',
    'setlocal',
    'cd /d "%~dp0.."',
    'if not exist ".env" (',
    '  copy /y ".env.example" ".env" >nul',
    ')',
    'docker compose up --build -d',
    'if errorlevel 1 exit /b %errorlevel%',
    'start "" "http://localhost:18420/today"',
    'echo LumeHub arrancado. Se for o primeiro arranque, espera alguns segundos e abre a pagina no browser.',
    '',
  ].join('\n');
}

function buildWindowsStopScript() {
  return [
    '@echo off',
    'setlocal',
    'cd /d "%~dp0.."',
    'docker compose down',
    '',
  ].join('\n');
}

function buildWindowsLogsScript() {
  return [
    '@echo off',
    'setlocal',
    'cd /d "%~dp0.."',
    'docker compose logs -f',
    '',
  ].join('\n');
}

function buildPosixStartScript() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'cd "$SCRIPT_DIR/.."',
    'if [[ ! -f .env ]]; then',
    '  cp .env.example .env',
    'fi',
    'docker compose up --build -d',
    'echo "LumeHub arrancado em http://localhost:18420/today"',
    '',
  ].join('\n');
}

function buildPosixStopScript() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'cd "$SCRIPT_DIR/.."',
    'docker compose down',
    '',
  ].join('\n');
}

function buildPosixLogsScript() {
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'cd "$SCRIPT_DIR/.."',
    'docker compose logs -f',
    '',
  ].join('\n');
}

function buildBundleReadme(bundleName, releaseId) {
  return [
    '# LumeHub Docker Desktop Bundle',
    '',
    `Bundle: \`${bundleName}\``,
    `Release: \`${releaseId}\``,
    '',
    'Este pacote foi pensado para entregar o LumeHub a outra pessoa de forma simples em Windows, macOS ou Linux, usando Docker Desktop ou outro runtime compatível com `docker compose`.',
    '',
    '## Arranque rapido em Windows',
    '',
    '1. Instalar `Docker Desktop`.',
    '2. Extrair este zip para uma pasta normal, por exemplo `C:\\LumeHub`.',
    '3. Escolher uma das opcoes de LLM:',
    '   - `Codex OAuth`: colocar `auth.json` dentro da pasta `auth\\`.',
    '   - `OpenAI compat`: abrir `.env` e preencher `OPENAI_API_KEY=`.',
    '4. Fazer duplo clique em `scripts\\start-lumehub.cmd`.',
    '5. Abrir `http://localhost:18420/today` se o browser nao abrir sozinho.',
    '',
    '## Scripts incluidos',
    '',
    '- `scripts/start-lumehub.cmd`',
    '- `scripts/stop-lumehub.cmd`',
    '- `scripts/show-logs.cmd`',
    '- `scripts/start-lumehub.sh`',
    '- `scripts/stop-lumehub.sh`',
    '- `scripts/show-logs.sh`',
    '',
    '## Pastas que importam',
    '',
    '- `auth/`: auth do Codex (`auth.json`) quando quiseres usar `Codex OAuth`.',
    '- `data/`: dados persistentes da aplicacao.',
    '- `logs/`: logs persistentes do container.',
    '- `state/`: estado do companion embebido, power policy e heartbeat.',
    '',
    '## O que este bundle faz',
    '',
    '- corre o backend do LumeHub dentro de um container',
    '- embebe o `host companion` dentro do mesmo container para manter heartbeat, sync-back de auth e estado operacional',
    '- persiste `data`, `logs`, `state` e `auth` fora da imagem',
    '',
    '## Limites honestos',
    '',
    '- Este bundle simplifica muito a entrega, mas nao controla automaticamente `sleep`, `autostart` ou outros aspetos do Windows fora do container.',
    '- Se nao houver `auth.json`, o `Codex Router` fica sem token live; nesse caso usa `OPENAI_API_KEY` e muda o provider para `OpenAI compat` no LumeHub.',
    '- O WhatsApp precisa de emparelhamento proprio no ambiente novo; a pasta `data/` guarda a sessao depois do primeiro QR.',
    '',
    '## Health check curto',
    '',
    '- `docker compose ps`',
    '- `docker compose logs -f`',
    '- `http://localhost:18420/api/runtime/diagnostics`',
    '',
  ].join('\n');
}

async function createZipArchive(bundleRoot, zipFilePath) {
  await rm(zipFilePath, { force: true });
  await execFileAsync('zip', ['-qr', zipFilePath, basename(bundleRoot)], {
    cwd: dirname(bundleRoot),
  });
}

async function createTarArchive(bundleRoot, tarFilePath) {
  await rm(tarFilePath, { force: true });
  await execFileAsync('tar', ['-czf', tarFilePath, basename(bundleRoot)], {
    cwd: dirname(bundleRoot),
  });
}

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function resetDirectory(directoryPath) {
  await rm(directoryPath, { recursive: true, force: true });
  await mkdir(directoryPath, { recursive: true });
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  await main();
}
