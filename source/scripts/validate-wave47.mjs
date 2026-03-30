import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const packageJson = JSON.parse(await readFile(resolve(SOURCE_ROOT, 'package.json'), 'utf8'));
const hardeningTest = await readFile(resolve(SOURCE_ROOT, 'tests/integration/wave11-hardening.test.mjs'), 'utf8');
const cutoverTest = await readFile(resolve(SOURCE_ROOT, 'tests/e2e/live-runtime-cutover.test.mjs'), 'utf8');
const builtInstructionQueueService = await readFile(
  resolve(
    SOURCE_ROOT,
    'packages/modules/instruction-queue/dist/modules/instruction-queue/src/application/services/InstructionQueueService.js',
  ),
  'utf8',
);

assert.equal(typeof packageJson.scripts['validate:wave47'], 'string');
assert.match(
  hardeningTest,
  /restart keeps fan-out dedupe and retry only reprocesses failed targets/u,
);
assert.match(cutoverTest, /Pronto para operar/u);
assert.doesNotMatch(cutoverTest, /Host companion/u);
assert.match(builtInstructionQueueService, /duplicate_instruction_of:/u);

console.log('validate-wave47: ok');
