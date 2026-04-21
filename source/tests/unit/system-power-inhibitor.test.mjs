import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { SleepInhibitorAdapter } = await import(
  '../../packages/modules/system-power/dist/modules/system-power/src/infrastructure/system/SleepInhibitorAdapter.js'
);

test('sleep inhibitor uses the WA-Notify systemd-inhibit contract', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-system-power-'));
  const inhibitorStatePath = join(sandboxPath, 'sleep-inhibitor.json');
  const spawnCalls = [];
  const killedPids = [];
  const alivePids = new Set([12345]);
  const fakeProcess = {
    pid: 12345,
    kill: () => {
      alivePids.delete(12345);
      return true;
    },
    unref: () => undefined,
    once: () => fakeProcess,
  };

  try {
    const adapter = new SleepInhibitorAdapter({
      inhibitorStatePath,
      spawnProcess: (command, args) => {
        spawnCalls.push({ command, args: [...args] });
        return fakeProcess;
      },
      isProcessAlive: (pid) => alivePids.has(pid),
      killProcess: (pid) => {
        killedPids.push(pid);
        alivePids.delete(pid);
      },
    });
    const lease = {
      leaseId: 'power-lease-test',
      reasons: ['host_companion'],
      explanation: 'Power policy requests a persistent inhibitor (host_companion).',
      acquiredAt: '2026-04-21T22:00:00.000Z',
      releasedAt: null,
    };

    await adapter.acquire(lease);

    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, '/usr/bin/systemd-inhibit');
    assert.deepEqual(spawnCalls[0].args.slice(0, 3), [
      '--what=sleep',
      '--mode=block',
      '--why=Keep-LumeHub-online',
    ]);
    assert.deepEqual(spawnCalls[0].args.slice(3), ['/bin/sh', '-c', 'while :; do sleep 3600; done']);
    assert.equal(await adapter.isActive(), true);

    const state = JSON.parse(await readFile(inhibitorStatePath, 'utf8'));
    assert.equal(state.provider, 'systemd-inhibit-process');
    assert.equal(state.pid, 12345);
    assert.deepEqual(state.lease, lease);

    await adapter.release();

    assert.deepEqual(killedPids, [12345]);
    assert.equal(await adapter.isActive(), false);
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

