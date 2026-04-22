import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');

const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
assert.match(packageJson.scripts['validate:wave74'], /validate-wave74\.mjs/u);

const appShell = await readFile(
  resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'src', 'shell', 'AppShell.ts'),
  'utf8',
);
assert.match(appShell, /options\.focusMainContent \?\? false/u);
assert.match(appShell, /focusMainContent: true/u);
assert.match(appShell, /Sistema ligado/u);
assert.match(appShell, /Preview seguro/u);
assert.match(appShell, /Ao mudar aqui, abres logo a pagina desse grupo/u);
assert.match(appShell, /Janela 5h restante/u);
assert.match(appShell, /Janela semanal restante/u);
assert.match(appShell, /Ativar esta conta/u);
assert.match(appShell, /refreshCodexAuthRouterStatus/u);
assert.doesNotMatch(appShell, /codex-router-token-details/u);
assert.doesNotMatch(appShell, /codex-router-switch:/u);
assert.doesNotMatch(appShell, /Runtime live/u);
assert.doesNotMatch(appShell, /workspace desse grupo/u);

const appCss = await readFile(
  resolve(SOURCE_ROOT, 'apps', 'lume-hub-web', 'src', 'styles', 'app.css'),
  'utf8',
);
assert.match(appCss, /--surface-empty-min-height: 168px/u);
assert.match(appCss, /@media \(max-width: 960px\)[\s\S]*\.shell-nav \{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\)/u);
assert.match(appCss, /@media \(max-width: 960px\)[\s\S]*\.nav-card \{[\s\S]*overflow-x: auto/u);
assert.match(appCss, /@media \(max-width: 960px\)[\s\S]*\.nav-card \{[\s\S]*scrollbar-width: none/u);
assert.match(appCss, /@media \(max-width: 640px\)[\s\S]*--surface-empty-min-height: 132px/u);
assert.match(appCss, /\.codex-router-summary-grid/u);
assert.match(appCss, /\.codex-router-window-card/u);

const frontendClient = await readFile(
  resolve(SOURCE_ROOT, 'packages', 'adapters', 'frontend-api-client', 'src', 'public', 'index.ts'),
  'utf8',
);
assert.match(frontendClient, /refreshCodexAuthRouterStatus/u);
assert.match(frontendClient, /\/api\/settings\/codex-auth-router\/refresh/u);

const httpAdapter = await readFile(
  resolve(SOURCE_ROOT, 'packages', 'adapters', 'http-fastify', 'src', 'public', 'index.ts'),
  'utf8',
);
assert.match(httpAdapter, /\/api\/settings\/codex-auth-router\/refresh/u);

const quotaService = await readFile(
  resolve(
    SOURCE_ROOT,
    'packages',
    'modules',
    'codex-auth-router',
    'src',
    'domain',
    'services',
    'CodexAccountQuotaService.ts',
  ),
  'utf8',
);
assert.match(quotaService, /clearCache\(\): void/u);

const implementationWaves = await readFile(
  resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'),
  'utf8',
);
assert.match(implementationWaves, /`validate:wave74`/u);
assert.match(implementationWaves, /Wave 75 - Grupos e WhatsApp sem repeticao operacional/u);
assert.match(implementationWaves, /Wave 78 - Limpeza final da ronda `ui-ux-commercial-polish`/u);
assert.doesNotMatch(implementationWaves, /Nao existem waves ativas neste momento/u);

const audit = await readFile(
  resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_ui_ux_audit_2026-04-22.md'),
  'utf8',
);
assert.match(audit, /Nao ha evidencia de pagina branca real/u);
assert.match(audit, /Grupos e pagina de grupo/u);
assert.match(audit, /Workspace/u);
assert.match(audit, /Wave 75/u);

console.log('Wave 74 UI/UX baseline validation passed');
