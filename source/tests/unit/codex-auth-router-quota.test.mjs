import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { CodexAccountQuotaService } = await import(
  '../../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/domain/services/CodexAccountQuotaService.js'
);
const { CodexAccountScorer } = await import(
  '../../packages/modules/codex-auth-router/dist/modules/codex-auth-router/src/domain/services/CodexAccountScorer.js'
);

test('codex auth router exposes safe quota snapshots without leaking OAuth tokens', async () => {
  const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-codex-quota-'));
  const authFilePath = join(sandboxPath, 'account-a', 'auth.json');
  const now = new Date('2026-04-22T10:00:00.000Z');
  const seenHeaders = [];

  try {
    await mkdir(join(sandboxPath, 'account-a'), { recursive: true });
    await writeFile(
      authFilePath,
      JSON.stringify({
        tokens: {
          account_id: 'account-a',
          access_token: 'unit-access-token',
          refresh_token: 'unit-refresh-token',
          id_token: 'unit-id-token',
        },
      }),
      'utf8',
    );

    const quotaService = new CodexAccountQuotaService({
      enabled: true,
      fetcher: async (_url, init) => {
        seenHeaders.push(init?.headers ?? {});
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              plan_type: 'plus',
              credits: {
                has_credits: true,
                unlimited: false,
                approx_local_messages: [12],
                approx_cloud_messages: [8],
              },
              rate_limit: {
                allowed: true,
                limit_reached: false,
                primary_window: {
                  limit_window_seconds: 18_000,
                  used_percent: 31,
                  reset_after_seconds: 900,
                  reset_at: '2026-04-22T10:15:00.000Z',
                },
              },
            });
          },
        };
      },
    });
    const [account] = await quotaService.enrichAccounts([buildAccount(authFilePath)], now);

    assert.equal(account.quota?.allowed, true);
    assert.equal(account.quota?.primaryWindow?.remainingPercent, 69);
    assert.equal(account.quota?.credits.hasCredits, true);
    assert.equal(account.quota?.planType, 'plus');
    assert.deepEqual(Object.keys(account.quota ?? {}).includes('access_token'), false);
    assert.match(seenHeaders[0].authorization, /^Bearer /u);
    assert.equal(seenHeaders[0]['chatgpt-account-id'], 'account-a');
  } finally {
    await rm(sandboxPath, { recursive: true, force: true });
  }
});

test('codex auth scorer prefers the token with more free quota', () => {
  const scorer = new CodexAccountScorer();
  const now = new Date('2026-04-22T10:00:00.000Z');
  const emptyState = {
    schemaVersion: 1,
    enabled: true,
    currentSelection: null,
    accountStates: {},
    switchHistory: [],
    lastPreparedAt: null,
    lastSwitchAt: null,
    lastError: null,
    updatedAt: null,
  };
  const lowQuota = buildAccount('/tmp/low.json', {
    remainingPercent: 8,
    usedPercent: 92,
  });
  const highQuota = buildAccount('/tmp/high.json', {
    remainingPercent: 83,
    usedPercent: 17,
  });

  assert.ok(scorer.score(highQuota, emptyState, now) > scorer.score(lowQuota, emptyState, now));
});

function buildAccount(sourceFilePath, quotaWindow) {
  return {
    accountId: sourceFilePath.includes('high') ? 'high' : 'account-a',
    label: 'Account A',
    sourceFilePath,
    priority: 1,
    kind: 'secondary',
    exists: true,
    contentHash: 'hash-a',
    bytes: 120,
    lastModifiedAt: '2026-04-22T09:00:00.000Z',
    usage: {
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastFailureKind: null,
      lastFailureReason: null,
      cooldownUntil: null,
    },
    quota: quotaWindow
      ? {
          checkedAt: '2026-04-22T10:00:00.000Z',
          allowed: true,
          limitReached: false,
          planType: 'plus',
          credits: {
            hasCredits: false,
            unlimited: false,
            balance: null,
            approxLocalMessages: [],
            approxCloudMessages: [],
          },
          primaryWindow: {
            windowSeconds: 18_000,
            usedPercent: quotaWindow.usedPercent,
            remainingPercent: quotaWindow.remainingPercent,
            resetAfterSeconds: 900,
            resetAt: '2026-04-22T10:15:00.000Z',
          },
          secondaryWindow: null,
          fetchError: null,
        }
      : null,
  };
}
