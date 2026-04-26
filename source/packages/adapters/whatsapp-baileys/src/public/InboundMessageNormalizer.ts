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

function extractContextInfo(payload: RawBaileysMessageEnvelope) {
  const content = unwrapMessageContent(payload.message);

  return content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? content?.audioMessage?.contextInfo
    ?? content?.messageContextInfo;
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
    const contextInfo = extractContextInfo(payload);
    const mentionedJids = dedupeStrings(contextInfo?.mentionedJid ?? []);

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
      ...(contextInfo?.stanzaId?.trim() ? { quotedMessageId: contextInfo.stanzaId.trim() } : {}),
      ...(contextInfo?.participant?.trim() ? { quotedParticipantJid: contextInfo.participant.trim() } : {}),
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

  let current = message;

  for (let index = 0; index < 5; index += 1) {
    const nested =
      current.deviceSentMessage?.message
      ?? current.groupMentionedMessage?.message
      ?? current.botInvokeMessage?.message
      ?? current.ephemeralMessage?.message
      ?? current.viewOnceMessage?.message
      ?? current.documentWithCaptionMessage?.message
      ?? current.viewOnceMessageV2?.message
      ?? current.viewOnceMessageV2Extension?.message
      ?? current.editedMessage?.message;

    if (!nested) {
      break;
    }

    current = nested;
  }

  return current;
}
