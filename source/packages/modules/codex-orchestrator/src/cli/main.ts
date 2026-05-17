#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

import type { AutomationWeekdayToken } from '@lume-hub/admin-config';

import { CodexOrchestratorModule } from '../module/CodexOrchestratorModule.js';

type Args = Record<string, string | boolean>;

const [, , command, subcommand, ...rest] = process.argv;

try {
  const args = parseArgs(rest);
  const orchestrator = new CodexOrchestratorModule({
    projectRoot: readString(args, 'project-root'),
    dataRootPath: readString(args, 'data-root'),
    adminPhoneFilePath: readString(args, 'admin-phone-file'),
  });
  const result = await execute(orchestrator, command, subcommand, args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function execute(
  orchestrator: CodexOrchestratorModule,
  command: string | undefined,
  subcommand: string | undefined,
  args: Args,
): Promise<unknown> {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    return help();
  }

  if (command === 'status') {
    return orchestrator.status();
  }

  if (command === 'admin' && subcommand === 'sync') {
    return orchestrator.syncAdminFromPhoneFile(readString(args, 'phone-file'));
  }

  if (command === 'policy' && subcommand === 'lockdown') {
    return orchestrator.lockdownToAdminAndScheduledGroups();
  }

  if (command === 'group' && subcommand === 'prompt-set') {
    return orchestrator.upsertGroupPrompt({
      groupJid: requireString(args, 'group-jid'),
      content: await readFile(requireString(args, 'file'), 'utf8'),
    });
  }

  if (command === 'schedule' && subcommand === 'create') {
    return orchestrator.createScheduleEvent({
      groupJid: requireString(args, 'group-jid'),
      title: requireString(args, 'title'),
      eventAt: requireString(args, 'at'),
      message: readString(args, 'message'),
    });
  }

  if (command === 'automation' && subcommand === 'add-one-shot') {
    return orchestrator.createAutomation({
      groupJid: requireString(args, 'group-jid'),
      schedule: {
        type: 'one_shot',
        startsAt: requireString(args, 'at'),
      },
      messageTemplate: requireString(args, 'message'),
      notifyBeforeMinutes: readNumberList(args, 'notify-before-minutes') ?? [0],
    });
  }

  if (command === 'automation' && subcommand === 'add-weekly') {
    return orchestrator.createWeeklyAutomation({
      groupJid: requireString(args, 'group-jid'),
      daysOfWeek: requireWeekdays(args, 'days'),
      time: requireString(args, 'time'),
      messageTemplate: requireString(args, 'message'),
      notifyBeforeMinutes: readNumberList(args, 'notify-before-minutes') ?? [0],
    });
  }

  throw new Error(`Unknown orchestrator command: ${[command, subcommand].filter(Boolean).join(' ')}`);
}

function help(): Record<string, readonly string[]> {
  return {
    commands: [
      'status',
      'admin sync --phone-file <path>',
      'policy lockdown',
      'group prompt-set --group-jid <jid> --file <prompt.md>',
      'schedule create --group-jid <jid> --title <title> --at <iso> [--message <text>]',
      'automation add-one-shot --group-jid <jid> --at <iso> --message <text>',
      'automation add-weekly --group-jid <jid> --days mon,wed --time HH:MM --message <text>',
    ],
  };
}

function parseArgs(values: readonly string[]): Args {
  const output: Args = {};

  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];

    if (!current.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${current}`);
    }

    const key = current.slice(2);
    const next = values[index + 1];

    if (!next || next.startsWith('--')) {
      output[key] = true;
      continue;
    }

    output[key] = next;
    index += 1;
  }

  return output;
}

function readString(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireString(args: Args, key: string): string {
  const value = readString(args, key);
  if (!value) {
    throw new Error(`Missing required --${key}`);
  }

  return value;
}

function readNumberList(args: Args, key: string): readonly number[] | undefined {
  const value = readString(args, key);
  if (!value) {
    return undefined;
  }

  return value
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item));
}

function requireWeekdays(args: Args, key: string): readonly AutomationWeekdayToken[] {
  const value = requireString(args, key);
  const tokens = value.split(',').map((item) => item.trim().toLowerCase());
  const allowed = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

  for (const token of tokens) {
    if (!allowed.has(token)) {
      throw new Error(`Invalid weekday token: ${token}`);
    }
  }

  return tokens as readonly AutomationWeekdayToken[];
}
