import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SOURCE_ROOT, '..');

const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
const scriptsDirectoryEntries = await readdir(resolve(SOURCE_ROOT, 'scripts'));
const implementationWaves = await readFile(
  resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'),
  'utf8',
);
const gapAudit = await readFile(resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_gap_audit.md'), 'utf8');
const readme = await readFile(resolve(REPO_ROOT, 'README.md'), 'utf8');
const sourceReadme = await readFile(resolve(SOURCE_ROOT, 'README.md'), 'utf8');
const releaseGuide = await readFile(
  resolve(REPO_ROOT, 'docs', 'deployment', 'lume_hub_release_publish.md'),
  'utf8',
);
const cutoverChecklist = await readFile(
  resolve(REPO_ROOT, 'docs', 'deployment', 'lume_hub_live_cutover_checklist.md'),
  'utf8',
);

const scriptNames = Object.keys(packageJson.scripts ?? {});
const legacyWaveScripts = scriptNames.filter((name) =>
  /^validate:wave(?:[1-9]|10|11|13|14|15|16|17|18|19|20|21|22|23)$/u.test(name),
);
const legacyWaveFiles = scriptsDirectoryEntries.filter((entry) =>
  /^validate-wave(?:[1-9]|10|11|13|14|15|16|17|18|19|20|21|22|23)\.mjs$/u.test(entry),
);

assert.deepEqual(
  legacyWaveScripts,
  [],
  `Legacy wave scripts still exposed in source/package.json: ${legacyWaveScripts.join(', ')}`,
);
assert.deepEqual(
  legacyWaveFiles,
  [],
  `Legacy wave validator files still present in source/scripts: ${legacyWaveFiles.join(', ')}`,
);

assert.match(implementationWaves, /Nao ha waves ativas neste momento\./u);
assert.doesNotMatch(implementationWaves, /## Wave 24/u);
assert.match(gapAudit, /nao ha gaps ativos a fechar em waves/iu);
assert.doesNotMatch(gapAudit, /Wave 24/u);
assert.match(readme, /As `Wave 0` a `Wave 24` ja foram executadas e validadas\./u);
assert.match(sourceReadme, /scripts operacionais de validacao final e release/u);
assert.match(releaseGuide, /validate:release/u);
assert.doesNotMatch(releaseGuide, /validate:wave12/u);
assert.doesNotMatch(JSON.stringify(packageJson.scripts ?? {}), /wave12/u);
assert.match(cutoverChecklist, /validate:wave24/u);

console.log(
  `Wave 24 validation passed: ${basename(resolve(REPO_ROOT, 'docs', 'architecture', 'lume_hub_implementation_waves.md'))} now reports no active waves.`,
);
