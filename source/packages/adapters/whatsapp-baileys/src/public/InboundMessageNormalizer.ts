import type { NormalizedInboundMessage, RawBaileysMessageEnvelope } from './types.js';

function normalizeTimestamp(value: RawBaileysMessageEnvelope['messageTimestamp']): string {
  if (typeof value === 'number') {
    return new Date(value * 1_000).toISOString();
  }

  if (typeof value === 'string') {
    const numeric = Number(value);

    if (!Number.isNaN(numeric)) {
      return new Date(numeric * 1_000).toISOString();
    }
  }

  if (typeof value === 'object' && value && typeof value.low === 'number') {
    return new Date(value.low * 1_000).toISOString();
  }

  return new Date().toISOString();
}

function extractText(payload: RawBaileysMessageEnvelope): string | undefined {
  const content = unwrapMessageContent(payload.message);

  return content?.conversation
    ?? content?.extendedTextMessage?.text
    ?? content?.imageMessage?.caption
    ?? content?.videoMessage?.caption
    ?? content?.documentMessage?.caption;
}

function extractContextInfos(payload: RawBaileysMessageEnvelope): readonly Record<string, unknown>[] {
  const content = unwrapMessageContent(payload.message);

  return [
    content?.extendedTextMessage?.contextInfo,
    content?.imageMessage?.contextInfo,
    content?.videoMessage?.contextInfo,
    content?.documentMessage?.contextInfo,
    content?.audioMessage?.contextInfo,
    readRecord(content)?.contextInfo,
    content?.messageContextInfo,
  ].map(readRecord).filter((entry): entry is Record<string, unknown> => entry !== null);
}

function fingerprintFor(participantJid: string, text: string): string {
  return `${participantJid}:${text}`
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .replace(/[^\p{L}\p{N}: ]/gu, '')
    .trim()
    .slice(0, 96);
}

export class InboundMessageNormalizer {
  normalize(payload: RawBaileysMessageEnvelope): NormalizedInboundMessage | undefined {
    const messageId = payload.key?.id?.trim();
    const chatJid = payload.key?.remoteJid?.trim();
    const text = extractText(payload)?.trim();

    if (!messageId || !chatJid || !text) {
      return undefined;
    }

    const isGroup = chatJid.endsWith('@g.us');
    const participantJid = (payload.key?.participant?.trim() || chatJid);
    const contextInfos = extractContextInfos(payload);
    const mentionedJids = dedupeStrings(contextInfos.flatMap((contextInfo) => readStringArray(contextInfo.mentionedJid)));
    const quotedMessageId = readFirstString(contextInfos, 'stanzaId');
    const quotedParticipantJid = readFirstString(contextInfos, 'participant');

    return {
      messageId,
      chatJid,
      participantJid,
      groupJid: isGroup ? chatJid : undefined,
      fromMe: payload.key?.fromMe ?? false,
      text,
      timestamp: normalizeTimestamp(payload.messageTimestamp),
      semanticFingerprint: fingerprintFor(participantJid, text),
      pushName: payload.pushName?.trim() || undefined,
      ...(mentionedJids.length > 0 ? { mentionedJids } : {}),
      ...(quotedMessageId ? { quotedMessageId } : {}),
      ...(quotedParticipantJid ? { quotedParticipantJid } : {}),
    };
  }
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function unwrapMessageContent(message: RawBaileysMessageEnvelope['message']): RawBaileysMessageEnvelope['message'] {
  if (!message) {
    return undefined;
  }

  let current: unknown = message;

  for (let index = 0; index < 5; index += 1) {
    const currentRecord = readRecord(current);
    if (!currentRecord) {
      return undefined;
    }

    const nested =
      readNestedMessage(currentRecord, 'deviceSentMessage')
      ?? readNestedMessage(currentRecord, 'groupMentionedMessage')
      ?? readNestedMessage(currentRecord, 'botInvokeMessage')
      ?? readNestedMessage(currentRecord, 'ephemeralMessage')
      ?? readNestedMessage(currentRecord, 'viewOnceMessage')
      ?? readNestedMessage(currentRecord, 'documentWithCaptionMessage')
      ?? readNestedMessage(currentRecord, 'viewOnceMessageV2')
      ?? readNestedMessage(currentRecord, 'viewOnceMessageV2Extension')
      ?? readNestedMessage(currentRecord, 'editedMessage')
      ?? readFirstGenericNestedMessage(currentRecord);

    if (!nested) {
      break;
    }

    current = nested;
  }

  return current as RawBaileysMessageEnvelope['message'];
}

function readNestedMessage(record: Record<string, unknown>, key: string): unknown {
  return readRecord(readRecord(record[key])?.message);
}

function readFirstGenericNestedMessage(record: Record<string, unknown>): unknown {
  for (const value of Object.values(record)) {
    const nestedMessage = readRecord(readRecord(value)?.message);

    if (nestedMessage) {
      return nestedMessage;
    }
  }

  return undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readFirstString(records: readonly Record<string, unknown>[], key: string): string | undefined {
  for (const record of records) {
    const value = readString(record[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
