import { readFile } from 'node:fs/promises';

import { SystemClock, type Clock } from '@lume-hub/clock';
import type {
  AdminConfigModuleContract,
  MessageAlertAction,
  MessageAlertMatch,
  MessageAlertRule,
  MessageAlertScope,
} from '@lume-hub/admin-config';
import type { NormalizedInboundMessage } from '@lume-hub/whatsapp-baileys';

import type {
  LegacyAlertImportReport,
  LegacyAlertImportRuleReport,
  MessageAlertMatchRecord,
} from '../../domain/entities/MessageAlert.js';
import { MessageAlertMatchRepository } from '../../infrastructure/persistence/MessageAlertMatchRepository.js';

interface LegacyAlertsFile {
  readonly rules?: readonly {
    readonly id?: string;
    readonly enabled?: boolean;
    readonly scope?:
      | { readonly type?: 'any' }
      | { readonly type?: 'group'; readonly jid?: string; readonly subject?: string }
      | { readonly type?: 'chat'; readonly jid?: string };
    readonly match?:
      | { readonly type?: 'includes'; readonly value?: string; readonly caseInsensitive?: boolean }
      | { readonly type?: 'regex'; readonly pattern?: string };
    readonly actions?: readonly (
      | { readonly type?: 'log' }
      | { readonly type?: 'webhook'; readonly url?: string; readonly method?: 'POST' | 'PUT'; readonly headers?: Record<string, string> }
    )[];
  }[];
}

type LegacyAlertRuleInput = NonNullable<LegacyAlertsFile['rules']>[number];
type LegacyAlertScopeInput = LegacyAlertRuleInput['scope'];
type LegacyAlertMatchInput = LegacyAlertRuleInput['match'];
type LegacyAlertActionInput = NonNullable<LegacyAlertRuleInput['actions']>[number];

export interface MessageAlertServiceConfig {
  readonly adminConfig: Pick<AdminConfigModuleContract, 'getSettings' | 'updateAlertsSettings'>;
  readonly legacyAlertsFilePath: string;
  readonly matchRepository: MessageAlertMatchRepository;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: Clock;
}

export class MessageAlertService {
  private readonly fetchImpl: typeof fetch;
  private readonly clock: Clock;

  constructor(private readonly config: MessageAlertServiceConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.clock = config.clock ?? new SystemClock();
  }

  async listRules(): Promise<readonly MessageAlertRule[]> {
    return (await this.config.adminConfig.getSettings()).alerts.rules;
  }

  async listRecentMatches(limit = 20): Promise<readonly MessageAlertMatchRecord[]> {
    const log = await this.config.matchRepository.read();
    return log.matches.slice(Math.max(0, log.matches.length - limit)).reverse();
  }

  async previewLegacyImport(): Promise<LegacyAlertImportReport> {
    return this.importLegacy('preview');
  }

  async applyLegacyImport(): Promise<LegacyAlertImportReport> {
    return this.importLegacy('apply');
  }

  async handleInbound(message: NormalizedInboundMessage): Promise<readonly MessageAlertMatchRecord[]> {
    const settings = await this.config.adminConfig.getSettings();

    if (!settings.alerts.enabled) {
      return [];
    }

    const matched: MessageAlertMatchRecord[] = [];

    for (const rule of settings.alerts.rules) {
      if (!matchesRule(rule, message)) {
        continue;
      }

      let webhookDeliveries = 0;

      for (const action of rule.actions) {
        if (action.type === 'webhook') {
          await this.fetchImpl(action.url, {
            method: action.method ?? 'POST',
            headers: {
              'content-type': 'application/json',
              ...(action.headers ?? {}),
            },
            body: JSON.stringify({
              ruleId: rule.ruleId,
              chatJid: message.chatJid,
              participantJid: message.participantJid,
              groupJid: message.groupJid ?? null,
              text: message.text,
              timestamp: message.timestamp,
            }),
          });
          webhookDeliveries += 1;
        }
      }

      const record: MessageAlertMatchRecord = {
        matchId: `${rule.ruleId}:${message.messageId}`,
        ruleId: rule.ruleId,
        chatJid: message.chatJid,
        participantJid: message.participantJid,
        groupJid: message.groupJid ?? null,
        text: message.text,
        matchedAt: this.clock.now().toISOString(),
        actionTypes: rule.actions.map((action) => action.type),
        webhookDeliveries,
      };

      await this.config.matchRepository.append(record);
      matched.push(record);
    }

    return matched;
  }

  private async importLegacy(mode: 'preview' | 'apply'): Promise<LegacyAlertImportReport> {
    const legacy = JSON.parse(await readFile(this.config.legacyAlertsFilePath, 'utf8')) as LegacyAlertsFile;
    const rules = (legacy.rules ?? []).map(toCanonicalRule).filter((rule): rule is MessageAlertRule => Boolean(rule));

    if (mode === 'apply') {
      await this.config.adminConfig.updateAlertsSettings({
        enabled: true,
        rules,
      });
    }

    return {
      mode,
      sourceFilePath: this.config.legacyAlertsFilePath,
      totals: {
        legacyRules: legacy.rules?.length ?? 0,
        importedRules: rules.length,
      },
      rules: rules.map(describeRule),
      importedRulesSnapshot: rules,
    };
  }
}

function matchesRule(rule: MessageAlertRule, message: NormalizedInboundMessage): boolean {
  if (!rule.enabled) {
    return false;
  }

  if (!matchesScope(rule.scope, message)) {
    return false;
  }

  return matchesText(rule.match, message.text);
}

function matchesScope(scope: MessageAlertScope, message: NormalizedInboundMessage): boolean {
  switch (scope.type) {
    case 'group':
      return message.groupJid === scope.groupJid;
    case 'group_subject':
      return false;
    case 'chat':
      return message.chatJid === scope.chatJid;
    default:
      return true;
  }
}

function matchesText(matcher: MessageAlertMatch, text: string): boolean {
  if (matcher.type === 'includes') {
    return matcher.caseInsensitive === false
      ? text.includes(matcher.value)
      : text.toLowerCase().includes(matcher.value.toLowerCase());
  }

  try {
    return createLegacyCompatibleRegex(matcher.pattern).test(text);
  } catch {
    return false;
  }
}

function createLegacyCompatibleRegex(pattern: string): RegExp {
  let source = pattern;
  const flags = new Set<string>();

  while (true) {
    const match = source.match(/^\(\?([ims]+)\)/);

    if (!match) {
      break;
    }

    for (const flag of match[1]) {
      flags.add(flag);
    }

    source = source.slice(match[0].length);
  }

  return new RegExp(source, [...flags].join(''));
}

function toCanonicalRule(rule: LegacyAlertRuleInput): MessageAlertRule | null {
  const ruleId = rule?.id?.trim();
  const scope = toCanonicalScope(rule?.scope);
  const match = toCanonicalMatch(rule?.match);
  const actions = toCanonicalActions(rule?.actions);

  if (!ruleId || !scope || !match || actions.length === 0) {
    return null;
  }

  return {
    ruleId,
    enabled: rule?.enabled !== false,
    label: null,
    scope,
    match,
    actions,
  };
}

function toCanonicalScope(scope: LegacyAlertScopeInput): MessageAlertScope | null {
  if (!scope || scope.type === 'any') {
    return { type: 'any' };
  }

  if (scope.type === 'group' && scope.jid?.trim()) {
    return {
      type: 'group',
      groupJid: scope.jid.trim(),
    };
  }

  if (scope.type === 'group' && scope.subject?.trim()) {
    return {
      type: 'group_subject',
      subject: scope.subject.trim(),
    };
  }

  if (scope.type === 'chat' && scope.jid?.trim()) {
    return {
      type: 'chat',
      chatJid: scope.jid.trim(),
    };
  }

  return null;
}

function toCanonicalMatch(match: LegacyAlertMatchInput): MessageAlertMatch | null {
  if (!match) {
    return null;
  }

  if (match.type === 'includes' && match.value?.trim()) {
    return {
      type: 'includes',
      value: match.value.trim(),
      caseInsensitive: match.caseInsensitive ?? true,
    };
  }

  if (match.type === 'regex' && match.pattern?.trim()) {
    return {
      type: 'regex',
      pattern: match.pattern,
    };
  }

  return null;
}

function toCanonicalActions(actions: readonly LegacyAlertActionInput[] | undefined): readonly MessageAlertAction[] {
  const normalized = (actions ?? [])
    .map((action: LegacyAlertActionInput): MessageAlertAction | null => {
      if (action?.type === 'webhook' && action.url?.trim()) {
        return {
          type: 'webhook',
          url: action.url.trim(),
          method: action.method ?? 'POST',
          headers: action.headers ?? {},
        };
      }

      if (action?.type === 'log') {
        return { type: 'log' };
      }

      return null;
    })
    .filter((action: MessageAlertAction | null): action is MessageAlertAction => Boolean(action));

  return normalized.length > 0 ? normalized : [{ type: 'log' }];
}

function describeRule(rule: MessageAlertRule): LegacyAlertImportRuleReport {
  return {
    ruleId: rule.ruleId,
    enabled: rule.enabled,
    scopeLabel:
      rule.scope.type === 'group'
        ? `grupo ${rule.scope.groupJid}`
        : rule.scope.type === 'group_subject'
          ? `grupo ${rule.scope.subject}`
          : rule.scope.type === 'chat'
            ? `chat ${rule.scope.chatJid}`
            : 'qualquer chat',
    matcherLabel:
      rule.match.type === 'regex'
        ? `regex ${rule.match.pattern}`
        : `contains ${rule.match.value}`,
    actionLabels: rule.actions.map((action) => (action.type === 'webhook' ? `webhook ${action.url}` : 'log')),
  };
}
