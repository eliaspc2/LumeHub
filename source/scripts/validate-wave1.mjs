import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const {
  ApplicationKernel,
  BaseModule,
  defineModule,
} = await import('../packages/foundation/kernel/dist/kernel/src/public/index.js');
const { ConfigResolver } = await import('../packages/foundation/config/dist/index.js');
const { DomainEventBus } = await import('../packages/foundation/events/dist/index.js');
const { LoggerFactory } = await import('../packages/foundation/logging/dist/index.js');
const {
  CALENDAR_SCHEMA_VERSION,
  DEFAULT_TIMEZONE,
  GroupCalendarFileRepository,
  GroupCalendarSchemaValidator,
  GroupFileLockManager,
  GroupPathResolver,
  GroupWorkspaceRepository,
  SETTINGS_SCHEMA_VERSION,
} = await import('../packages/adapters/persistence-group-files/dist/index.js');

const sandboxPath = await mkdtemp(join(tmpdir(), 'lume-hub-wave1-'));

try {
  const resolver = new ConfigResolver();
  const config = await resolver.resolve({
    overrides: {
      appName: 'lume-hub-wave1-validation',
      dataRoot: join(sandboxPath, 'data'),
      timezone: DEFAULT_TIMEZONE,
    },
  });

  assert.equal(config.timezone, DEFAULT_TIMEZONE);

  const loggerFactory = new LoggerFactory({ level: 'silent' });
  loggerFactory.createModuleLogger('wave1-validation').info('validating wave 1');
  loggerFactory.createAuditLogger().audit('wave1.validation.started');

  const seenEvents = [];
  const eventBus = new DomainEventBus();
  eventBus.subscribe('wave1.validation', async (event) => {
    seenEvents.push(event.payload.status);
  });
  await eventBus.publish({
    type: 'wave1.validation',
    payload: { status: 'ok' },
    occurredAt: new Date(),
  });
  assert.deepEqual(seenEvents, ['ok']);

  const lifecycle = [];

  class DemoModule extends BaseModule {
    constructor(name, dependencies = []) {
      super({
        name,
        version: '0.1.0',
        dependencies,
      });
    }

    async start() {
      lifecycle.push(`start:${this.name}`);
    }

    async stop() {
      lifecycle.push(`stop:${this.name}`);
    }
  }

  const kernel = new ApplicationKernel([
    defineModule(
      {
        name: 'storage',
        version: '0.1.0',
        dependencies: [],
      },
      () => new DemoModule('storage'),
    ),
    defineModule(
      {
        name: 'dispatcher',
        version: '0.1.0',
        dependencies: ['storage'],
      },
      () => new DemoModule('dispatcher', ['storage']),
    ),
  ]);

  await kernel.start();
  await kernel.stop();

  assert.deepEqual(lifecycle, [
    'start:storage',
    'start:dispatcher',
    'stop:dispatcher',
    'stop:storage',
  ]);

  const pathResolver = new GroupPathResolver({ dataRootPath: config.dataRoot });
  const lockManager = new GroupFileLockManager({
    timeoutMs: 2_000,
    retryDelayMs: 25,
    staleMs: 5_000,
  });
  const validator = new GroupCalendarSchemaValidator();
  const settingsRepository = new GroupWorkspaceRepository(pathResolver, lockManager, undefined, validator);
  const calendarRepository = new GroupCalendarFileRepository(pathResolver, lockManager, undefined, validator);

  const settings = await settingsRepository.ensureSettings({
    timezone: DEFAULT_TIMEZONE,
  });
  assert.equal(settings.schemaVersion, SETTINGS_SCHEMA_VERSION);

  const readSettings = await settingsRepository.readSettings();
  assert.deepEqual(readSettings, settings);

  const month = await calendarRepository.ensureCalendarMonth({
    groupJid: '120363407086801381@g.us',
    groupLabel: 'Wave 1 Validation',
    year: 2026,
    month: 3,
    timezone: settings.timezone,
  });
  assert.equal(month.schemaVersion, CALENDAR_SCHEMA_VERSION);
  assert.equal(month.events.length, 0);

  const savedMonth = await calendarRepository.saveCalendarMonth({
    ...month,
    events: [
      {
        eventId: 'evt-validation-001',
        weekId: '2026-W13',
        groupJid: month.groupJid,
        groupLabel: month.groupLabel,
        eventAt: '2026-03-25T10:00:00+00:00',
        notifications: [
          {
            jobId: 'job-validation-001',
            weekId: '2026-W13',
            ruleType: 'fixed_local_time',
            sendAt: '2026-03-24T10:00:00+00:00',
            status: 'pending',
            attempts: 0,
            lastError: null,
            lastOutboundObservationAt: null,
            confirmedAt: null,
          },
        ],
      },
    ],
  });

  const rereadMonth = await calendarRepository.readCalendarMonth({
    groupJid: savedMonth.groupJid,
    year: savedMonth.year,
    month: savedMonth.month,
  });

  assert.deepEqual(rereadMonth, savedMonth);

  await assert.rejects(
    async () => {
      validator.validateCalendar({
        groupJid: savedMonth.groupJid,
      });
    },
    /schemaVersion/i,
  );

  const calendarPath = pathResolver.resolveGroupCalendarPath(savedMonth.groupJid, savedMonth.year, savedMonth.month);
  const lockOrder = [];

  const firstLock = lockManager.withLock(calendarPath, async () => {
    lockOrder.push('first:start');
    await new Promise((resolve) => setTimeout(resolve, 100));
    lockOrder.push('first:end');
  });

  await new Promise((resolve) => setTimeout(resolve, 10));

  const secondLock = lockManager.withLock(calendarPath, async () => {
    lockOrder.push('second:start');
    lockOrder.push('second:end');
  });

  await Promise.all([firstLock, secondLock]);

  assert.deepEqual(lockOrder, [
    'first:start',
    'first:end',
    'second:start',
    'second:end',
  ]);

  const calendarDirectoryEntries = await readdir(join(config.dataRoot, 'groups', savedMonth.groupJid, 'calendar'));
  assert.deepEqual(calendarDirectoryEntries, ['2026-03.json']);

  console.log(`Wave 1 validation passed in ${sandboxPath}`);
} finally {
  await rm(sandboxPath, { recursive: true, force: true });
}
