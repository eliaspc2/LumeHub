import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const repoRoot = new URL('../../', import.meta.url);

await expectMissing('legacy_healthy_code/ready_to_port');
await expectMissing('docs/reuse/lume_hub_healthy_code_manifest.md');
await expectMissing('source/packages/modules/alerts');
await expectMissing('source/packages/modules/automations');

const waves = await readText('docs/architecture/lume_hub_implementation_waves.md');
assert.match(waves, /Nao ha waves pendentes neste momento\./u);
assert.doesNotMatch(waves, /^## Wave /mu);

const readme = await readText('README.md');
assert.match(readme, /Wave 0` a `Wave 17/u);
assert.doesNotMatch(readme, /healthy_code_manifest/u);

const agents = await readText('AGENTS.md');
assert.doesNotMatch(agents, /ready_to_port/u);
assert.doesNotMatch(agents, /healthy_code_manifest/u);
assert.match(agents, /reference_engines/u);

const sourcePackage = await readText('source/package.json');
assert.match(sourcePackage, /validate:wave17/u);
assert.doesNotMatch(sourcePackage, /preview:wave13/u);

const tsBase = await readText('source/tsconfig.base.json');
assert.doesNotMatch(tsBase, /@lume-hub\/alerts/u);
assert.doesNotMatch(tsBase, /@lume-hub\/automations/u);

console.log('Wave 17 validation passed.');

async function readText(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

async function expectMissing(relativePath) {
  try {
    await access(new URL(relativePath, repoRoot));
  } catch (error) {
    if (isMissing(error)) {
      return;
    }

    throw error;
  }

  assert.fail(`${relativePath} should have been removed in Wave 17.`);
}

function isMissing(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
