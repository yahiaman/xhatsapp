import { createHash } from 'node:crypto';

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim() !== '')?.trim() || '';
}

function toDate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
    if (!Number.isNaN(date.valueOf())) return date;
  }
  if (typeof value === 'string' && value !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return toDate(numeric);
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date;
  }
  return new Date();
}

function syntheticId({ chatId, senderId, timestamp, text }) {
  return `synthetic:${createHash('sha256')
    .update(`${chatId}|${senderId}|${timestamp ?? ''}|${text}`)
    .digest('hex')}`;
}

export function safeReference(value) {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function extractMessage(payload) {
  const data = payload?.data || payload?.message || payload || {};

  const text = firstString(
    data.text,
    data.body,
    data.content,
    data.caption,
    data.message?.text,
    data.message?.body,
    data.message?.conversation,
    data.message?.extendedTextMessage?.text,
  );

  const chatId = firstString(
    data.chatId,
    data.from,
    data.remoteJid,
    data.key?.remoteJid,
    data.message?.chatId,
    data.message?.from,
    data.message?.key?.remoteJid,
  );

  const senderId = firstString(
    data.senderId,
    data.author,
    data.participant,
    data.key?.participant,
    data.contact?.id,
    data.sender?.id,
  );

  const senderName = firstString(
    data.notifyName,
    data.contact?.pushName,
    data.sender?.pushName,
    data.sender?.name,
  );

  const chatName = firstString(
    data.chatName,
    data.chat?.name,
    data.chat?.formattedTitle,
  );

  const fromMe = data.fromMe === true
    || data.key?.fromMe === true
    || data.message?.fromMe === true
    || data.message?.key?.fromMe === true;

  const timestamp = data.timestamp ?? data.t ?? payload?.timestamp ?? payload?.ts;
  const explicitId = firstString(
    data.id,
    data.messageId,
    data.key?.id,
    data.message?.id,
    data.message?.key?.id,
  );

  const messageId = explicitId || syntheticId({ chatId, senderId, timestamp, text });

  return {
    messageId,
    chatId,
    chatName: chatName || null,
    senderId: senderId || null,
    senderName: senderName || null,
    text: text || null,
    fromMe,
    isGroup: data.isGroup === true || chatId.endsWith('@g.us'),
    messageType: firstString(data.type) || 'unknown',
    receivedAt: toDate(timestamp),
  };
}
