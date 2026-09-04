import { readAnnounce } from './schedule.js';

async function setAndVerify(openWa, chatId, announce) {
  await openWa.updateGroupSettings(chatId, { announce });
  let lastReadError = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, openWa.verificationDelayMs ?? 1_000));
    }
    try {
      const current = await openWa.getGroupSettings(chatId);
      if (readAnnounce(current) === announce) return;
    } catch (error) {
      lastReadError = error;
    }
  }
  if (lastReadError) throw lastReadError;
  throw new Error('group_setting_not_confirmed');
}

export async function verifySchedulePermission(openWa, chatId) {
  const current = await openWa.getGroupSettings(chatId);
  const announce = readAnnounce(current);
  if (typeof announce !== 'boolean') throw new Error('group_announce_setting_missing');
  await setAndVerify(openWa, chatId, announce);
  return true;
}

export async function executeScheduledAction({
  action, chatId, message, openWa, errorLabel, previous = {},
}) {
  let messageStatus = previous.messageStatus || 'pending';
  let settingsStatus = previous.settingsStatus || 'pending';
  let openWaMessageId = previous.openWaMessageId || null;
  const errors = [];
  const capture = (error) => errors.push(errorLabel(error));

  if (action === 'close') {
    if (messageStatus !== 'sent') try {
      const sent = await openWa.sendText(chatId, message);
      openWaMessageId = sent?.messageId || sent?.id || sent?.data?.messageId || sent?.data?.id || null;
      messageStatus = 'sent';
    } catch (error) {
      messageStatus = 'failed';
      capture(error);
    }
    if (settingsStatus !== 'verified') try {
      await setAndVerify(openWa, chatId, true);
      settingsStatus = 'verified';
    } catch (error) {
      settingsStatus = 'failed';
      capture(error);
    }
  } else if (action === 'open') {
    if (settingsStatus !== 'verified') try {
      await setAndVerify(openWa, chatId, false);
      settingsStatus = 'verified';
    } catch (error) {
      settingsStatus = 'failed';
      messageStatus = 'skipped';
      capture(error);
    }
    if (settingsStatus === 'verified' && messageStatus !== 'sent') {
      try {
        const sent = await openWa.sendText(chatId, message);
        openWaMessageId = sent?.messageId || sent?.id || sent?.data?.messageId || sent?.data?.id || null;
        messageStatus = 'sent';
      } catch (error) {
        messageStatus = 'failed';
        capture(error);
      }
    }
  } else {
    throw new Error('invalid_schedule_action');
  }

  const status = settingsStatus === 'verified' && messageStatus === 'sent'
    ? 'completed'
    : (settingsStatus === 'failed' && ['failed', 'skipped'].includes(messageStatus) ? 'failed' : 'partial_failed');
  return { status, messageStatus, settingsStatus, openWaMessageId, safeError: errors.join(',') || null };
}
