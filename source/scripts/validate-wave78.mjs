import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');

const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
assert.match(packageJson.scripts['validate:wave78'], /validate-wave78\.mjs/u);
assert.equal(packageJson.scripts['validate:wave74'], undefined);
assert.equal(packageJson.scripts['validate:wave75'], undefined);
assert.equal(packageJson.scripts['validate:wave76'], undefined);

const implementationWaves = await readFile(
  resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'),
  'utf8',
);
assert.match(implementationWaves, /Ronda ativa: `gui-simplification-pass-2`/u);
assert.match(implementationWaves, /Wave 78 fechou a ronda `ui-ux-commercial-polish`/u);
assert.match(implementationWaves, /Wave 79 - Alertas falsos e Hoje com radar live/u);
assert.match(implementationWaves, /Wave 83 - Limpeza final da ronda `gui-simplification-pass-2`/u);
assert.doesNotMatch(implementationWaves, /### Wave 78 - Limpeza final da ronda `ui-ux-commercial-polish`/u);

const readme = await readFile(resolve(REPO_ROOT, 'README.md'), 'utf8');
assert.match(readme, /Wave 78/u);
assert.match(readme, /validate:wave78/u);

const gapAudit = await readFile(
  resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_gap_audit.md'),
  'utf8',
);
assert.match(gapAudit, /Wave 78/u);
assert.match(gapAudit, /validate:wave78/u);
assert.match(gapAudit, /Nao restam gaps ativos nesta ronda/u);

console.log('Wave 78 cleanup validation passed');
