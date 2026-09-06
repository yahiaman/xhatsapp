import express from 'express';
import {
  addForbiddenAgency,
  addModerationKeyword,
  checkDatabase,
  cancelBroadcastDraft,
  claimBroadcastDraft,
  createBroadcastDraft,
  createModerationAlert,
  deleteForbiddenAgency,
  deleteModerationKeyword,
  finalizeBroadcastDraft,
  getBroadcastExecution,
  getAdminTarget,
  getGroupPolicy,
  getPendingModerationAlert,
  listForbiddenAgencies,
  listGroupPolicies,
  listBroadcastDrafts,
  listModerationAlerts,
  listModerationKeywords,
  listGroupSchedules,
  listScheduleRuns,
  listResumableBroadcastIds,
  markBroadcastDeliveryFailed,
  markBroadcastDeliverySending,
  markBroadcastDeliverySent,
  markModerationAlertNotified,
  pool,
  recordModerationAlertError,
  recordBroadcastDraftError,
  resolveModerationAlert,
  storeMessage,
  syncGroupInventory,
  updateGroupPolicy,
  updateGroupSchedule,
  getScheduleTarget,
  claimScheduleRun,
  finishScheduleRun,
  cancelRecapDraft,
  claimDailyRecap,
  claimRecapDraft,
  failRecapGeneration,
  finalizeRecapDraft,
  finishRecapGeneration,
  getRecapExecution,
  getRecapPreview,
  getRecapSettings,
  listRecapDrafts,
  listRecapSourceGroups,
  listRecapTargetGroups,
  listConsolidatedRecapMessages,
  listResumableRecapIds,
  markRecapDeliveryFailed,
  markRecapDeliverySending,
  markRecapDeliverySent,
  updateRecapSettings,
} from './db.js';
import { extractMessage, safeReference } from './message.js';
import { decideMessagePolicy } from './policy.js';
import { verifyOpenWaSignature } from './security.js';
import { adminAuth, adminHtml, parseAgency, parseKeyword, parsePolicy, readGroupInventory } from './admin.js';
import {
  buildModerationAlert,
  createAlertCode,
  detectModeration,
  parseModerationCommand,
} from './moderation.js';
import { createOpenWaClient, OpenWaApiError } from './openwa.js';
import {
  buildBroadcastPreview,
  buildBroadcastSummary,
  createBroadcastCode,
  parseBroadcastCommand,
  parseCommunicationDraft,
} from './broadcast.js';
import { dueAction, parseSchedule } from './schedule.js';
import { executeScheduledAction, verifySchedulePermission } from './scheduler.js';
import {
  appendSignature,
  buildRecapPreview,
  createSummaryClient,
  createRecapCode,
  parseRecapCommand,
  recapIsDue,
  summarizeConsolidated,
  summarizeGroup,
} from './recap.js';
import {
  auditDuplicates,
  buildDuplicateAdminAlert,
  buildDuplicateAuditReport,
  buildDuplicateRefusalDm,
  buildFlashMessage,
  buildLockNotice,
  buildOnboardingDm,
  buildPanicAlert,
  buildUnlockNotice,
  detectPanic,
  parseCommunityCommand,
} from './community.js';

const port = Number(process.env.PORT || 3000);
const webhookSecret = process.env.OPENWA_WEBHOOK_SECRET || '';
const adminToken = process.env.XHATSAPP_ADMIN_TOKEN || '';
const inventoryPath = process.env.XHATSAPP_GROUP_INVENTORY || '/config/openwa-groups.json';
const openWaBaseUrl = process.env.OPENWA_API_URL || 'http://openwa:2785';
const openWaSessionId = process.env.OPENWA_SESSION_ID || '';
const openWaApiKey = process.env.XHATSAPP_OPENWA_API_KEY || '';
const broadcastDelayMs = Math.max(0, Math.min(
  Number(process.env.BROADCAST_SEND_DELAY_MS || 750),
  5_000,
));
const summaryProvider = process.env.SUMMARY_PROVIDER || 'omniroute';
const summaryBaseUrl = process.env.SUMMARY_API_URL || 'http://omniroute:20128/v1';
const summaryApiKey = process.env.SUMMARY_API_KEY || '';
const summaryModel = process.env.SUMMARY_MODEL || 'pending';

if (!webhookSecret) throw new Error('OPENWA_WEBHOOK_SECRET is required');
if (!adminToken) throw new Error('XHATSAPP_ADMIN_TOKEN is required');
if (!openWaSessionId) throw new Error('OPENWA_SESSION_ID is required');
if (!openWaApiKey) throw new Error('XHATSAPP_OPENWA_API_KEY is required');

const openWa = createOpenWaClient({
  baseUrl: openWaBaseUrl,
  sessionId: openWaSessionId,
  apiKey: openWaApiKey,
});
const summaryClient = createSummaryClient({
  provider: summaryProvider,
  baseUrl: summaryBaseUrl,
  apiKey: summaryApiKey,
  model: summaryModel,
});

function responseMessageId(body) {
  const values = [body?.messageId, body?.id, body?.data?.messageId, body?.data?.id, body?.message?.id];
  return values.find((value) => typeof value === 'string' && value) || null;
}

function safeOperationalError(error) {
  if (error instanceof OpenWaApiError) return `${error.operation}:http_${error.status}`;
  if (error instanceof Error && /^summary_(?:provider_invalid|model_not_configured|api_key_not_configured|http_[0-9]{3})$/.test(error.message)) {
    return error.message;
  }
  return error instanceof Error ? error.name : 'unknown_error';
}

let forbiddenAgenciesCache = [];

async function reloadForbiddenAgencies() {
  try {
    const agencies = await listForbiddenAgencies();
    forbiddenAgenciesCache = agencies.map((agency) => agency.name);
    console.log('Forbidden agencies cache reloaded', { count: forbiddenAgenciesCache.length });
  } catch (error) {
    console.warn('Forbidden agencies cache reload failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  }
}

let moderationKeywordsCache = { donation: [], advertising: [] };

async function reloadModerationKeywords() {
  try {
    const list = await listModerationKeywords();
    const donation = [];
    const advertising = [];
    for (const item of list) {
      if (item.category === 'donation') donation.push(item.term);
      else if (item.category === 'advertising') advertising.push(item.term);
    }
    moderationKeywordsCache = { donation, advertising };
    console.log('Moderation keywords cache reloaded', {
      donation: donation.length,
      advertising: advertising.length,
    });
  } catch (error) {
    console.warn('Moderation keywords cache reload failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  }
}

async function newModerationAlert(messageInternalId, sourceGroupId, detection, status = 'pending') {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await createModerationAlert({
        messageInternalId,
        sourceGroupId,
        detection,
        code: createAlertCode(),
        status,
      });
    } catch (error) {
      if (error?.code !== '23505') throw error;
    }
  }
  throw new Error('moderation_code_generation_failed');
}

async function notifyModerators(message, groupPolicy, messageInternalId, detection, autoDeleted = false) {
  const status = autoDeleted ? 'auto_deleted' : 'pending';
  const alert = await newModerationAlert(messageInternalId, groupPolicy.id, detection, status);
  if (!alert) return null;
  try {
    const admin = await getAdminTarget();
    const text = buildModerationAlert({
      code: alert.code,
      categories: alert.categories,
      groupName: groupPolicy.name,
      groupReference: groupPolicy.inventory_ref || safeReference(message.chatId),
      senderName: message.senderName,
      text: message.text,
      autoDeleted,
      matchedAgencies: detection.matchedAgencies || [],
    });
    const sent = await openWa.sendText(admin.chat_id, text);
    await markModerationAlertNotified(alert.id, responseMessageId(sent));
    console.log('Moderation alert sent', {
      code: alert.code,
      source_group_ref: groupPolicy.inventory_ref || safeReference(message.chatId),
      admin_group_ref: admin.inventory_ref || safeReference(admin.chat_id),
      categories: alert.categories,
      auto_deleted: autoDeleted,
    });
  } catch (error) {
    const safeError = safeOperationalError(error);
    await recordModerationAlertError(alert.id, safeError);
    console.error('Moderation alert delivery failed', { code: alert.code, error: safeError });
  }
  return alert;
}

async function handleModerationCommand(message, command) {
  const alert = await getPendingModerationAlert(command.code);
  if (!alert) {
    await openWa.sendText(message.chatId, `Référence ${command.code} introuvable ou déjà traitée.`);
    return { handled: false, reason: 'alert_not_pending' };
  }
  const decision = {
    code: command.code,
    decisionMessageId: message.messageId,
    decisionByRef: safeReference(message.senderId),
  };
  if (command.action === 'ignore') {
    const resolved = await resolveModerationAlert({ ...decision, status: 'ignored' });
    if (resolved) await openWa.sendText(message.chatId, `✅ ${command.code} ignorée. Aucune suppression effectuée.`);
    return { handled: Boolean(resolved), status: 'ignored' };
  }

  try {
    await openWa.deleteMessage(alert.chat_id, alert.message_id);
    const resolved = await resolveModerationAlert({ ...decision, status: 'deleted' });
    if (resolved) {
      await openWa.sendText(message.chatId, `🗑️ ${command.code} supprimée pour tous.`).catch(() => {});
    }
    return { handled: Boolean(resolved), status: 'deleted' };
  } catch (error) {
    const safeError = safeOperationalError(error);
    await recordModerationAlertError(alert.id, safeError);
    await openWa.sendText(
      message.chatId,
      `⚠️ Échec de suppression pour ${command.code}. L’alerte reste en attente.`,
    ).catch(() => {});
    console.error('Moderation deletion failed', { code: command.code, error: safeError });
    return { handled: false, reason: 'delete_failed' };
  }
}

async function newBroadcastDraft(message, groupPolicy, messageInternalId, text) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await createBroadcastDraft({
        code: createBroadcastCode(),
        sourceMessageId: messageInternalId,
        adminGroupId: groupPolicy.id,
        body: text,
        createdByRef: safeReference(message.senderId),
      });
    } catch (error) {
      if (error?.code !== '23505') throw error;
    }
  }
  throw new Error('broadcast_code_generation_failed');
}

async function handleCommunicationDraft(message, groupPolicy, messageInternalId, parsed) {
  if (parsed.error) {
    const labels = {
      communication_empty: 'Le message de communication est vide.',
      communication_too_long: 'Le message dépasse la limite de 3 500 caractères.',
    };
    await openWa.sendText(message.chatId, `⚠️ ${labels[parsed.error] || 'Brouillon invalide.'}`);
    return { handled: false, reason: parsed.error };
  }
  let draft;
  try {
    draft = await newBroadcastDraft(message, groupPolicy, messageInternalId, parsed.text);
  } catch (error) {
    if (error instanceof Error && error.message === 'no_broadcast_targets') {
      await openWa.sendText(
        message.chatId,
        '⚠️ Aucun groupe actif n’est autorisé pour la diffusion.',
      ).catch(() => {});
      return { handled: false, reason: 'no_broadcast_targets' };
    }
    throw error;
  }
  if (!draft) return { handled: false, reason: 'broadcast_duplicate' };
  try {
    await openWa.sendText(message.chatId, buildBroadcastPreview({
      code: draft.code,
      text: draft.body,
      destinations: draft.destinations,
    }));
    console.log('Broadcast draft created', {
      code: draft.code,
      destinations: draft.destinations.length,
      admin_group_ref: groupPolicy.inventory_ref || safeReference(message.chatId),
    });
  } catch (error) {
    const safeError = safeOperationalError(error);
    await recordBroadcastDraftError(draft.id, safeError);
    console.error('Broadcast preview delivery failed', { code: draft.code, error: safeError });
  }
  return { handled: true, code: draft.code };
}

const activeBroadcasts = new Set();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function processBroadcast(draftId) {
  if (activeBroadcasts.has(draftId)) return;
  activeBroadcasts.add(draftId);
  try {
    const execution = await getBroadcastExecution(draftId);
    if (!execution) return;
    for (let index = 0; index < execution.deliveries.length; index += 1) {
      const delivery = execution.deliveries[index];
      if (!await markBroadcastDeliverySending(delivery.id)) continue;
      try {
        const sent = await openWa.sendText(delivery.chat_id, execution.body);
        await markBroadcastDeliverySent(delivery.id, responseMessageId(sent));
        console.log('Broadcast destination sent', {
          code: execution.code,
          group_ref: delivery.inventory_ref || safeReference(delivery.chat_id),
        });
      } catch (error) {
        const safeError = safeOperationalError(error);
        await markBroadcastDeliveryFailed(delivery.id, safeError);
        console.error('Broadcast destination failed', {
          code: execution.code,
          group_ref: delivery.inventory_ref || safeReference(delivery.chat_id),
          error: safeError,
        });
      }
      if (broadcastDelayMs > 0 && index < execution.deliveries.length - 1) {
        await delay(broadcastDelayMs);
      }
    }
    const summary = await finalizeBroadcastDraft(draftId);
    if (!summary) return;
    await openWa.sendText(execution.admin_chat_id, buildBroadcastSummary({
      code: summary.code,
      sent: summary.sent,
      failed: summary.failed,
    })).catch(() => {});
    console.log('Broadcast completed', {
      code: summary.code,
      status: summary.status,
      sent: summary.sent,
      failed: summary.failed,
    });
  } catch (error) {
    const safeError = safeOperationalError(error);
    await recordBroadcastDraftError(draftId, safeError).catch(() => {});
    console.error('Broadcast processing failed', {
      draft_ref: safeReference(draftId),
      error: safeError,
    });
    setTimeout(() => void processBroadcast(draftId), 30_000).unref();
  } finally {
    activeBroadcasts.delete(draftId);
  }
}

async function handleBroadcastCommand(message, command) {
  const decision = {
    code: command.code,
    decisionMessageId: message.messageId,
    decisionByRef: safeReference(message.senderId),
  };
  if (command.action === 'cancel') {
    const cancelled = await cancelBroadcastDraft(decision);
    await openWa.sendText(
      message.chatId,
      cancelled
        ? `🚫 Communication ${command.code} annulée.`
        : `Référence ${command.code} introuvable ou non annulable.`,
    ).catch(() => {});
    return { handled: Boolean(cancelled), status: cancelled ? 'cancelled' : 'not_actionable' };
  }

  const claimed = await claimBroadcastDraft({ ...decision, action: command.action });
  await openWa.sendText(
    message.chatId,
    claimed
      ? `🚀 Diffusion ${command.code} démarrée.`
      : `Référence ${command.code} introuvable ou non publiable dans cet état.`,
  ).catch(() => {});
  if (claimed) setImmediate(() => void processBroadcast(claimed.id));
  return { handled: Boolean(claimed), status: claimed ? 'publishing' : 'not_actionable' };
}

const activeRecaps = new Set();

async function processRecap(draftId) {
  if (activeRecaps.has(draftId)) return;
  activeRecaps.add(draftId);
  try {
    const execution = await getRecapExecution(draftId);
    if (!execution) return;
    for (let index = 0; index < execution.deliveries.length; index += 1) {
      const delivery = execution.deliveries[index];
      if (!await markRecapDeliverySending(delivery.id)) continue;
      try {
        const sent = await openWa.sendText(delivery.chat_id, delivery.body);
        await markRecapDeliverySent(delivery.id, responseMessageId(sent));
        console.log('Recap destination sent', {
          code: execution.code,
          group_ref: delivery.inventory_ref || safeReference(delivery.chat_id),
        });
      } catch (error) {
        const safeError = safeOperationalError(error);
        await markRecapDeliveryFailed(delivery.id, safeError);
        console.error('Recap destination failed', {
          code: execution.code,
          group_ref: delivery.inventory_ref || safeReference(delivery.chat_id),
          error: safeError,
        });
      }
      if (broadcastDelayMs > 0 && index < execution.deliveries.length - 1) await delay(broadcastDelayMs);
    }
    const summary = await finalizeRecapDraft(draftId);
    if (summary) {
      await openWa.sendText(
        execution.admin_chat_id,
        summary.failed === 0
          ? `✅ Récapitulatif ${summary.code} diffusé dans ${summary.sent} groupe(s).`
          : `⚠️ Récapitulatif ${summary.code} : ${summary.sent} envoyé(s), ${summary.failed} en échec. Utilisez REESSAYER RECAP ${summary.code}.`,
      ).catch(() => {});
    }
  } catch (error) {
    console.error('Recap processing failed', {
      draft_ref: safeReference(draftId), error: safeOperationalError(error),
    });
  } finally {
    activeRecaps.delete(draftId);
  }
}

async function handleRecapCommand(message, command) {
  const decision = {
    code: command.code,
    decisionMessageId: message.messageId,
    decisionByRef: safeReference(message.senderId),
  };
  if (command.action === 'cancel') {
    const cancelled = await cancelRecapDraft(decision);
    await openWa.sendText(message.chatId, cancelled
      ? `🚫 Récapitulatif ${command.code} annulé.`
      : `Référence ${command.code} introuvable ou non annulable.`).catch(() => {});
    return { handled: Boolean(cancelled), status: cancelled ? 'cancelled' : 'not_actionable' };
  }
  const claimed = await claimRecapDraft({ ...decision, action: command.action });
  await openWa.sendText(message.chatId, claimed
    ? `🚀 Diffusion du récapitulatif ${command.code} démarrée.`
    : `Référence ${command.code} introuvable ou non publiable dans cet état.`).catch(() => {});
  if (claimed) setImmediate(() => void processRecap(claimed.id));
  return { handled: Boolean(claimed), status: claimed ? 'publishing' : 'not_actionable' };
}

async function claimNewDailyRecap(localDate) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await claimDailyRecap({ code: createRecapCode(), localDate });
    } catch (error) {
      if (error?.code !== '23505') throw error;
    }
  }
  throw new Error('recap_code_generation_failed');
}

async function generateDailyRecap(localDate, settings) {
  const draft = await claimNewDailyRecap(localDate);
  if (!draft) return;
  try {
    const targetGroups = await listRecapTargetGroups();
    if (!targetGroups.length) {
      await finishRecapGeneration({ draftId: draft.id, deliveries: [] });
      console.log('Daily recap skipped: no target groups configured', { local_date: localDate });
      return;
    }
    const messages = await listConsolidatedRecapMessages(localDate, settings.timezone);
    if (!messages.length) {
      await finishRecapGeneration({ draftId: draft.id, deliveries: [] });
      console.log('Daily recap empty: no messages exchanged today', { local_date: localDate });
      return;
    }

    const summary = await summarizeConsolidated({
      summaryClient, localDate, messages,
    });
    const finalBody = appendSignature(summary, settings.signature);

    const deliveries = targetGroups.map((group) => ({
      groupId: group.id,
      name: group.name,
      reference: group.reference,
      messageCount: messages.length,
      body: finalBody,
    }));

    await finishRecapGeneration({ draftId: draft.id, deliveries });

    const admin = await getAdminTarget();
    if (admin) {
      const preview = await getRecapPreview(draft.id);
      await openWa.sendText(admin.chat_id, buildRecapPreview(preview));
      await openWa.sendText(admin.chat_id, `📝 *Aperçu du récapitulatif commun :*\n\n${finalBody}`);
    }
    console.log('Daily recap draft ready', {
      code: draft.code, local_date: localDate, destinations: deliveries.length, messages: messages.length,
    });
  } catch (error) {
    const safeError = safeOperationalError(error);
    await failRecapGeneration(draft.id, safeError).catch(() => {});
    const admin = await getAdminTarget().catch(() => null);
    if (admin) await openWa.sendText(
      admin.chat_id,
      `⚠️ Échec de génération du récapitulatif du ${localDate}. Nouvelle tentative automatique prévue.`,
    ).catch(() => {});
    console.error('Daily recap generation failed', { local_date: localDate, error: safeError });
  }
}

async function handleCommunityCommand(message, command) {
  if (command.type === 'block_all') {
    const allGroups = await listGroupPolicies();
    const monitoredGroups = allGroups.filter((g) => g.enabled && g.is_monitored);
    let lockedCount = 0;
    for (const group of monitoredGroups) {
      try {
        await openWa.updateGroupSettings(group.chat_id, { announce: true });
        await openWa.sendText(group.chat_id, buildLockNotice()).catch(() => {});
        lockedCount += 1;
      } catch (error) {
        console.error('Failed to lock group', { group: group.name, error: safeOperationalError(error) });
      }
    }
    await openWa.sendText(
      message.chatId,
      `🔒 *TOUS LES GROUPES ONT ÉTÉ VERROUILLÉS*\n\n${lockedCount}/${monitoredGroups.length} groupe(s) surveillé(s) sont passés en mode "Annonce uniquement".\n\nPour rouvrir les discussions, tapez : *UNBLOCK ALL*`,
    ).catch(() => {});
    return { handled: true, status: 'all_blocked' };
  }

  if (command.type === 'unblock_all') {
    const allGroups = await listGroupPolicies();
    const monitoredGroups = allGroups.filter((g) => g.enabled && g.is_monitored);
    let unlockedCount = 0;
    for (const group of monitoredGroups) {
      try {
        await openWa.updateGroupSettings(group.chat_id, { announce: false });
        await openWa.sendText(group.chat_id, buildUnlockNotice()).catch(() => {});
        unlockedCount += 1;
      } catch (error) {
        console.error('Failed to unlock group', { group: group.name, error: safeOperationalError(error) });
      }
    }
    await openWa.sendText(
      message.chatId,
      `🔓 *TOUS LES GROUPES ONT ÉTÉ DÉVERROUILLÉS*\n\n${unlockedCount}/${monitoredGroups.length} groupe(s) surveillé(s) sont de nouveau ouverts à tous les membres.`,
    ).catch(() => {});
    return { handled: true, status: 'all_unblocked' };
  }

  if (command.type === 'flash') {
    if (command.error === 'flash_empty') {
      await openWa.sendText(
        message.chatId,
        '⚠️ Le message du FLASH est vide. Format attendu : *FLASH <Votre message>*',
      ).catch(() => {});
      return { handled: false, reason: 'flash_empty' };
    }

    const allGroups = await listGroupPolicies();
    const monitoredGroups = allGroups.filter((g) => g.enabled && g.is_monitored);

    // 1. Verrouillage préalable de sécurité
    for (const group of monitoredGroups) {
      await openWa.updateGroupSettings(group.chat_id, { announce: true }).catch(() => {});
    }

    // 2. Diffusion du flash
    const flashBody = buildFlashMessage(command.message);
    let sentCount = 0;
    for (let index = 0; index < monitoredGroups.length; index += 1) {
      const group = monitoredGroups[index];
      try {
        await openWa.sendText(group.chat_id, flashBody);
        sentCount += 1;
      } catch (error) {
        console.error('Failed to broadcast flash to group', { group: group.name, error: safeOperationalError(error) });
      }
      if (broadcastDelayMs > 0 && index < monitoredGroups.length - 1) {
        await delay(broadcastDelayMs);
      }
    }

    await openWa.sendText(
      message.chatId,
      `🚨 *FLASH INFO OFFICIEL DIFFUSÉ*\n\nDiffusé dans ${sentCount}/${monitoredGroups.length} groupe(s).\n\n🔒 *Rappel :* Tous les groupes sont actuellement verrouillés. Tapez *UNBLOCK ALL* lorsque vous souhaitez rouvrir les échanges.`,
    ).catch(() => {});
    return { handled: true, status: 'flash_broadcasted' };
  }

  if (command.type === 'audit_doublons') {
    const allGroups = await listGroupPolicies();
    const monitoredGroups = allGroups.filter((g) => g.enabled && g.is_monitored);
    await openWa.sendText(
      message.chatId,
      `🔍 Audit des membres en cours sur ${monitoredGroups.length} groupe(s)...`,
    ).catch(() => {});

    const groupsWithParticipants = [];
    for (const group of monitoredGroups) {
      try {
        const groupInfo = await openWa.getGroup(group.chat_id);
        groupsWithParticipants.push({
          id: group.chat_id,
          name: group.name || group.inventory_ref || group.chat_id,
          participants: groupInfo?.participants || [],
        });
      } catch (error) {
        console.error('Failed to retrieve group participants for audit', { group: group.name, error: safeOperationalError(error) });
      }
    }

    const audit = auditDuplicates(groupsWithParticipants);
    const report = buildDuplicateAuditReport(audit);
    await openWa.sendText(message.chatId, report).catch(() => {});
    return { handled: true, status: 'audit_completed' };
  }

  return { handled: false, reason: 'unknown_community_command' };
}

async function handleGroupJoinEvent(payload) {
  const groupId = payload?.groupId;
  const participantIds = Array.isArray(payload?.participantIds) ? payload.participantIds : [];
  if (!groupId || !participantIds.length) {
    return { ignored: true, reason: 'missing_group_or_participants' };
  }

  const groupPolicy = await getGroupPolicy(groupId).catch(() => null);
  if (!groupPolicy || !groupPolicy.enabled || !groupPolicy.is_monitored) {
    return { ignored: true, reason: 'group_not_monitored' };
  }

  const allGroups = await listGroupPolicies();
  const otherMonitoredGroups = allGroups.filter(
    (g) => g.enabled && g.is_monitored && g.chat_id !== groupId,
  );

  const adminTarget = await getAdminTarget().catch(() => null);

  const otherGroupsInfo = [];
  for (const other of otherMonitoredGroups) {
    try {
      const info = await openWa.getGroup(other.chat_id);
      if (info && Array.isArray(info.participants)) {
        otherGroupsInfo.push({
          group: other,
          participants: info.participants,
        });
      }
    } catch (error) {
      console.warn('Could not inspect other group members for duplicate check', {
        other_group: other.name,
        error: safeOperationalError(error),
      });
    }
  }

  let currentGroupInfo = null;
  try {
    currentGroupInfo = await openWa.getGroup(groupId);
  } catch (error) {
    console.warn('Could not inspect current group info', { error: safeOperationalError(error) });
  }

  for (const participantId of participantIds) {
    const rawDigits = participantId.replace(/\D/g, '');
    const currentParticipant = currentGroupInfo?.participants?.find(
      (p) => p.id === participantId || (rawDigits && p.number === rawDigits),
    );

    if (currentParticipant?.isAdmin || currentParticipant?.isSuperAdmin) {
      console.log('Group join: participant is admin/moderator, exempted from checks', {
        participant_ref: safeReference(participantId),
      });
      continue;
    }

    let existingGroup = null;
    for (const otherInfo of otherGroupsInfo) {
      const found = otherInfo.participants.find(
        (p) => p.id === participantId || (rawDigits && p.number === rawDigits),
      );
      if (found) {
        existingGroup = otherInfo.group;
        break;
      }
    }

    if (existingGroup) {
      console.log('Group join: duplicate participant detected, kicking from new group', {
        participant_ref: safeReference(participantId),
        new_group: groupPolicy.name,
        existing_group: existingGroup.name,
      });

      try {
        await openWa.removeParticipants(groupId, [participantId]);
      } catch (error) {
        console.error('Failed to remove duplicate participant', {
          participant_ref: safeReference(participantId),
          error: safeOperationalError(error),
        });
      }

      const refusalDm = buildDuplicateRefusalDm(
        groupPolicy.name || groupPolicy.inventory_ref || 'Nouveau groupe',
        existingGroup.name || existingGroup.inventory_ref || 'Groupe existant',
      );
      try {
        await openWa.sendText(participantId, refusalDm);
      } catch (error) {
        console.error('Failed to send duplicate refusal DM', {
          participant_ref: safeReference(participantId),
          error: safeOperationalError(error),
        });
      }

      if (adminTarget) {
        const adminAlert = buildDuplicateAdminAlert({
          senderPhone: rawDigits,
          senderReference: safeReference(participantId),
          newGroupName: groupPolicy.name || groupPolicy.inventory_ref || 'Nouveau groupe',
          existingGroupName: existingGroup.name || existingGroup.inventory_ref || 'Groupe existant',
        });
        await openWa.sendText(adminTarget.chat_id, adminAlert).catch(() => {});
      }
    } else {
      console.log('Group join: first-time participant, sending onboarding DM', {
        participant_ref: safeReference(participantId),
        group: groupPolicy.name,
      });
      const onboardingDm = buildOnboardingDm();
      try {
        await openWa.sendText(participantId, onboardingDm);
      } catch (error) {
        console.error('Failed to send onboarding DM', {
          participant_ref: safeReference(participantId),
          error: safeOperationalError(error),
        });
      }
    }
  }

  return { handled: true };
}

const app = express();
app.disable('x-powered-by');

app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'xhatsapp-webhook', version: '0.6.0' });
});

app.get('/ready', async (_request, response) => {
  try {
    await checkDatabase();
    response.json({ ok: true, status: 'ready' });
  } catch {
    response.status(503).json({ ok: false, status: 'not_ready' });
  }
});

app.post('/webhook/openwa', express.raw({ type: 'application/json', limit: '2mb' }), async (request, response) => {
  const signature = request.header('X-OpenWA-Signature');
  if (!verifyOpenWaSignature(request.body, signature, webhookSecret)) {
    response.status(401).json({ ok: false, error: 'invalid_signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(request.body.toString('utf8'));
  } catch {
    response.status(400).json({ ok: false, error: 'invalid_json' });
    return;
  }

  const delivery = {
    eventName: request.header('X-OpenWA-Event') || payload?.event || 'unknown',
    idempotencyKey: request.header('X-OpenWA-Idempotency-Key') || null,
    deliveryId: request.header('X-OpenWA-Delivery-Id') || null,
    retryCount: Number(request.header('X-OpenWA-Retry-Count') || 0),
  };

  if (delivery.eventName === 'group.join') {
    try {
      const joinResult = await handleGroupJoinEvent(payload);
      response.status(200).json({ ok: true, event: 'group.join', ...joinResult });
    } catch (error) {
      console.error('Group join handling failed', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      response.status(500).json({ ok: false, error: 'internal_error' });
    }
    return;
  }

  if (delivery.eventName !== 'message.received') {
    response.status(200).json({ ok: true, ignored: true, reason: 'event_not_supported' });
    return;
  }

  try {
    const message = extractMessage(payload);
    if (!message.chatId || !message.messageId) {
      response.status(200).json({ ok: true, ignored: true, reason: 'missing_identifiers' });
      return;
    }

    const groupPolicy = message.isGroup ? await getGroupPolicy(message.chatId) : null;
    const decision = decideMessagePolicy(message, groupPolicy);
    if (!decision.allowed) {
      console.log('OpenWA message ignored', {
        reason: decision.reason,
        chat_ref: safeReference(message.chatId),
      });
      response.status(200).json({ ok: true, ignored: true, reason: decision.reason });
      return;
    }

    const result = await storeMessage(message, delivery);
    console.log('OpenWA message accepted', {
      event: delivery.eventName,
      message_ref: safeReference(message.messageId),
      chat_ref: safeReference(message.chatId),
      inserted: result.inserted,
      retry_count: delivery.retryCount,
    });

    let status = result.inserted ? 'stored' : 'duplicate';
    if (result.inserted && !message.fromMe && groupPolicy.is_admin) {
      const communityCommand = parseCommunityCommand(message.text);
      const moderationCommand = parseModerationCommand(message.text);
      const broadcastCommand = parseBroadcastCommand(message.text);
      const recapCommand = parseRecapCommand(message.text);
      const communicationDraft = parseCommunicationDraft(message.text);
      if (communityCommand) {
        const commandResult = await handleCommunityCommand(message, communityCommand);
        status = commandResult.handled ? `community_${commandResult.status}` : commandResult.reason;
      } else if (moderationCommand) {
        const commandResult = await handleModerationCommand(message, moderationCommand);
        status = commandResult.handled ? `moderation_${commandResult.status}` : commandResult.reason;
      } else if (recapCommand) {
        const commandResult = await handleRecapCommand(message, recapCommand);
        status = commandResult.handled ? `recap_${commandResult.status}` : commandResult.status;
      } else if (broadcastCommand) {
        const commandResult = await handleBroadcastCommand(message, broadcastCommand);
        status = commandResult.handled ? `broadcast_${commandResult.status}` : commandResult.status;
      } else if (communicationDraft) {
        const draftResult = await handleCommunicationDraft(
          message,
          groupPolicy,
          result.internalId,
          communicationDraft,
        );
        status = draftResult.handled ? 'broadcast_pending' : draftResult.reason;
      }
    } else if (result.inserted && !message.fromMe && groupPolicy.is_monitored) {
      const detection = detectModeration(message.text, forbiddenAgenciesCache, moderationKeywordsCache);
      if (detection.isForbiddenAgency) {
        try {
          await openWa.deleteMessage(message.chatId, message.messageId);
        } catch (error) {
          console.error('Failed to auto-delete forbidden agency message', {
            chat_ref: safeReference(message.chatId),
            message_ref: safeReference(message.messageId),
            error: safeOperationalError(error),
          });
        }
        try {
          await openWa.sendText(
            message.chatId,
            "⚠️ Pas de citation de nom d'agence dans notre groupe car nous sommes neutres à ce sujet. Merci pour votre compréhension.",
          );
        } catch (error) {
          console.error('Failed to send neutrality warning', {
            chat_ref: safeReference(message.chatId),
            error: safeOperationalError(error),
          });
        }
        const alert = await notifyModerators(message, groupPolicy, result.internalId, detection, true);
        status = alert ? 'agency_auto_deleted' : status;
      } else if (detection.flagged) {
        const alert = await notifyModerators(message, groupPolicy, result.internalId, detection, false);
        status = alert ? 'flagged' : status;
      } else {
        const panic = detectPanic(message.text);
        if (panic.isPanic) {
          try {
            const admin = await getAdminTarget();
            if (admin) {
              const panicAlert = buildPanicAlert({
                groupName: groupPolicy.name,
                groupReference: groupPolicy.inventory_ref || safeReference(message.chatId),
                senderName: message.senderName,
                senderReference: safeReference(message.senderId),
                text: message.text,
                matches: panic.matches,
              });
              await openWa.sendText(admin.chat_id, panicAlert);
              console.log('Panic/rumor sentinel alert sent', {
                group_ref: safeReference(message.chatId),
                matches: panic.matches,
              });
            }
          } catch (error) {
            console.error('Panic sentinel delivery failed', { error: safeOperationalError(error) });
          }
        }
      }
    }

    response.status(200).json({ ok: true, status });
  } catch (error) {
    console.error('OpenWA webhook failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    response.status(500).json({ ok: false, error: 'internal_error' });
  }
});

app.get('/admin', (_request, response) => {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  response.type('html').send(adminHtml);
});

const requireAdmin = adminAuth(adminToken);
app.use('/admin/api', requireAdmin, express.json({ limit: '64kb' }));

app.get('/admin/api/groups', async (_request, response) => {
  try {
    response.json({ ok: true, groups: await listGroupPolicies() });
  } catch {
    response.status(500).json({ ok: false, error: 'groups_list_failed' });
  }
});

app.get('/admin/api/moderation', async (request, response) => {
  try {
    response.json({ ok: true, alerts: await listModerationAlerts(request.query.limit) });
  } catch {
    response.status(500).json({ ok: false, error: 'moderation_list_failed' });
  }
});

app.get('/admin/api/agencies', async (_request, response) => {
  try {
    response.json({ ok: true, agencies: await listForbiddenAgencies() });
  } catch {
    response.status(500).json({ ok: false, error: 'agencies_list_failed' });
  }
});

app.post('/admin/api/agencies', async (request, response) => {
  const parsed = parseAgency(request.body);
  if (!parsed) {
    response.status(400).json({ ok: false, error: 'invalid_agency' });
    return;
  }
  try {
    const agency = await addForbiddenAgency(parsed.name);
    await reloadForbiddenAgencies();
    response.json({ ok: true, agency });
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ ok: false, error: 'agency_already_exists' });
      return;
    }
    console.error('Agency add failed', { error: error instanceof Error ? error.message : 'unknown_error' });
    response.status(500).json({ ok: false, error: 'agency_add_failed' });
  }
});

app.delete('/admin/api/agencies/:id', async (request, response) => {
  try {
    const deleted = await deleteForbiddenAgency(request.params.id);
    if (!deleted) {
      response.status(404).json({ ok: false, error: 'agency_not_found' });
      return;
    }
    await reloadForbiddenAgencies();
    response.json({ ok: true, deleted: true });
  } catch {
    response.status(500).json({ ok: false, error: 'agency_delete_failed' });
  }
});

app.get('/admin/api/keywords', async (request, response) => {
  try {
    const category = typeof request.query?.category === 'string' ? request.query.category.trim() : null;
    response.json({ ok: true, keywords: await listModerationKeywords(category) });
  } catch {
    response.status(500).json({ ok: false, error: 'keywords_list_failed' });
  }
});

app.post('/admin/api/keywords', async (request, response) => {
  const parsed = parseKeyword(request.body);
  if (!parsed) {
    response.status(400).json({ ok: false, error: 'invalid_keyword' });
    return;
  }
  try {
    const item = await addModerationKeyword(parsed.category, parsed.term);
    await reloadModerationKeywords();
    response.json({ ok: true, keyword: item });
  } catch (error) {
    if (error?.code === '23505') {
      response.status(409).json({ ok: false, error: 'keyword_already_exists' });
      return;
    }
    console.error('Keyword add failed', { error: error instanceof Error ? error.message : 'unknown_error' });
    response.status(500).json({ ok: false, error: 'keyword_add_failed' });
  }
});

app.delete('/admin/api/keywords/:id', async (request, response) => {
  try {
    const deleted = await deleteModerationKeyword(request.params.id);
    if (!deleted) {
      response.status(404).json({ ok: false, error: 'keyword_not_found' });
      return;
    }
    await reloadModerationKeywords();
    response.json({ ok: true, deleted: true });
  } catch {
    response.status(500).json({ ok: false, error: 'keyword_delete_failed' });
  }
});

app.get('/admin/api/broadcasts', async (request, response) => {
  try {
    response.json({ ok: true, drafts: await listBroadcastDrafts(request.query.limit) });
  } catch {
    response.status(500).json({ ok: false, error: 'broadcast_list_failed' });
  }
});

app.get('/admin/api/schedules', async (_request, response) => {
  try {
    const schedules = (await listGroupSchedules()).map(({ chatId: _chatId, ...item }) => item);
    response.json({ ok: true, schedules });
  } catch {
    response.status(500).json({ ok: false, error: 'schedules_list_failed' });
  }
});

app.get('/admin/api/schedule-runs', async (request, response) => {
  try {
    response.json({ ok: true, runs: await listScheduleRuns(request.query.limit) });
  } catch {
    response.status(500).json({ ok: false, error: 'schedule_runs_list_failed' });
  }
});

app.get('/admin/api/recaps', async (request, response) => {
  try {
    response.json({ ok: true, recaps: await listRecapDrafts(request.query.limit) });
  } catch {
    response.status(500).json({ ok: false, error: 'recaps_list_failed' });
  }
});

app.get('/admin/api/recap-settings', async (_request, response) => {
  try {
    response.json({ ok: true, settings: await getRecapSettings() });
  } catch {
    response.status(500).json({ ok: false, error: 'recap_settings_failed' });
  }
});

app.put('/admin/api/recap-settings', async (request, response) => {
  const signature = typeof request.body?.signature === 'string' ? request.body.signature.trim() : null;
  if (signature === null || signature.length > 600) {
    response.status(400).json({ ok: false, error: 'invalid_signature' });
    return;
  }
  try {
    response.json({ ok: true, settings: await updateRecapSettings({ signature }) });
  } catch {
    response.status(500).json({ ok: false, error: 'recap_settings_update_failed' });
  }
});

app.put('/admin/api/schedules/:id', async (request, response) => {
  const schedule = parseSchedule(request.body);
  if (!schedule) {
    response.status(400).json({ ok: false, error: 'invalid_schedule' });
    return;
  }
  if (schedule.confirmationRequired) {
    response.status(409).json({ ok: false, error: 'confirmation_required' });
    return;
  }
  try {
    const updated = await updateGroupSchedule(request.params.id, schedule);
    if (!updated) {
      response.status(404).json({ ok: false, error: 'eligible_group_not_found' });
      return;
    }
    const { chatId: _chatId, ...publicValue } = updated;
    console.log('Group schedule updated', {
      group_ref: updated.groupReference,
      enabled: updated.enabled,
      timezone: updated.timezone,
      weekdays: updated.weekdays,
      open_time: updated.openTime,
      close_time: updated.closeTime,
    });
    response.json({ ok: true, schedule: publicValue });
  } catch {
    response.status(500).json({ ok: false, error: 'schedule_update_failed' });
  }
});

app.post('/admin/api/schedules/:id/check', async (request, response) => {
  if (request.body?.confirm !== true) {
    response.status(409).json({ ok: false, error: 'confirmation_required' });
    return;
  }
  try {
    const target = await getScheduleTarget(request.params.id);
    if (!target || !target.enabled) {
      response.status(404).json({ ok: false, error: 'enabled_group_not_found' });
      return;
    }
    await verifySchedulePermission(openWa, target.chat_id);
    console.log('Group schedule permission verified', {
      group_ref: target.inventory_ref || safeReference(target.chat_id),
    });
    response.json({ ok: true, verified: true });
  } catch (error) {
    console.error('Group schedule permission failed', { error: safeOperationalError(error) });
    response.status(409).json({ ok: false, error: 'openwa_admin_permission_required' });
  }
});

app.post('/admin/api/groups/sync', async (_request, response) => {
  try {
    const groups = await readGroupInventory(inventoryPath);
    const result = await syncGroupInventory(groups);
    response.json({ ok: true, imported: result.imported });
  } catch (error) {
    console.error('Group inventory sync failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    response.status(500).json({ ok: false, error: 'group_inventory_sync_failed' });
  }
});

app.put('/admin/api/groups/:id', async (request, response) => {
  const policy = parsePolicy(request.body);
  if (!policy) {
    response.status(400).json({ ok: false, error: 'invalid_policy' });
    return;
  }
  if (policy.confirmationRequired) {
    response.status(409).json({ ok: false, error: 'confirmation_required' });
    return;
  }
  try {
    const group = await updateGroupPolicy(request.params.id, policy);
    if (!group) {
      response.status(404).json({ ok: false, error: 'group_not_found' });
      return;
    }
    console.log('Group policy updated', {
      group_ref: group.reference,
      enabled: group.enabled,
      test: group.isTest,
      monitored: group.isMonitored,
      admin: group.isAdmin,
      auto_reply: group.allowAutoReply,
      broadcast: group.allowBroadcast,
      recap: group.allowRecap,
    });
    response.json({ ok: true, group });
  } catch {
    response.status(500).json({ ok: false, error: 'group_update_failed' });
  }
});

app.use((_request, response) => {
  response.status(404).json({ ok: false, error: 'not_found' });
});

try {
  const groups = await readGroupInventory(inventoryPath);
  const result = await syncGroupInventory(groups);
  console.log('Group inventory synchronized', { imported: result.imported });
} catch (error) {
  console.warn('Group inventory unavailable', {
    error: error instanceof Error ? error.message : 'unknown_error',
  });
}

try {
  await reloadForbiddenAgencies();
} catch (error) {
  console.warn('Forbidden agencies initialization failed', {
    error: error instanceof Error ? error.message : 'unknown_error',
  });
}

try {
  await reloadModerationKeywords();
} catch (error) {
  console.warn('Moderation keywords initialization failed', {
    error: error instanceof Error ? error.message : 'unknown_error',
  });
}

const server = app.listen(port, '0.0.0.0', () => {
  console.log('Webhook listening', { port, version: '0.6.0' });
});

const activeScheduleGroups = new Set();

async function processDueSchedule(schedule, due) {
  if (activeScheduleGroups.has(schedule.groupId)) return;
  const run = await claimScheduleRun({
    groupId: schedule.groupId,
    action: due.action,
    localDate: due.localDate,
  });
  if (!run) return;
  activeScheduleGroups.add(schedule.groupId);
  try {
    const result = await executeScheduledAction({
      action: due.action,
      chatId: schedule.chatId,
      message: due.action === 'open' ? schedule.openMessage : schedule.closeMessage,
      openWa,
      errorLabel: safeOperationalError,
      previous: {
        messageStatus: run.message_status,
        settingsStatus: run.settings_status,
        openWaMessageId: run.openwa_message_id,
      },
    });
    await finishScheduleRun({ runId: run.id, ...result });
    console.log('Group schedule executed', {
      group_ref: schedule.groupReference || safeReference(schedule.chatId),
      action: due.action,
      local_date: due.localDate,
      status: result.status,
      attempt: run.attempts,
    });
    if (result.status !== 'completed') {
      const admin = await getAdminTarget();
      await openWa.sendText(
        admin.chat_id,
        `⚠️ Horaire ${due.action === 'open' ? 'd’ouverture' : 'de fermeture'} en échec pour ${schedule.groupName} (${schedule.groupReference}). Nouvelle tentative automatique prévue.`,
      ).catch(() => {});
    }
  } catch (error) {
    const safeError = safeOperationalError(error);
    await finishScheduleRun({
      runId: run.id, status: 'failed', messageStatus: 'failed',
      settingsStatus: 'failed', safeError,
    }).catch(() => {});
    console.error('Group schedule failed', {
      group_ref: schedule.groupReference || safeReference(schedule.chatId),
      action: due.action,
      error: safeError,
    });
  } finally {
    activeScheduleGroups.delete(schedule.groupId);
  }
}

let scheduleTickRunning = false;
async function scheduleTick() {
  if (scheduleTickRunning) return;
  scheduleTickRunning = true;
  try {
    const schedules = await listGroupSchedules({ enabledOnly: true });
    const now = new Date();
    for (const schedule of schedules) {
      const due = dueAction(schedule, now);
      if (due) await processDueSchedule(schedule, due);
    }
  } catch (error) {
    console.error('Schedule tick failed', { error: safeOperationalError(error) });
  } finally {
    scheduleTickRunning = false;
  }
}

setTimeout(() => void scheduleTick(), 5_000).unref();
const scheduleTimer = setInterval(() => void scheduleTick(), 30_000);
scheduleTimer.unref();

let recapTickRunning = false;
async function recapTick() {
  if (recapTickRunning) return;
  recapTickRunning = true;
  try {
    const settings = await getRecapSettings();
    const localDate = recapIsDue(settings);
    if (localDate) await generateDailyRecap(localDate, settings);
  } catch (error) {
    console.error('Recap tick failed', { error: safeOperationalError(error) });
  } finally {
    recapTickRunning = false;
  }
}

setTimeout(() => void recapTick(), 15_000).unref();
const recapTimer = setInterval(() => void recapTick(), 60_000);
recapTimer.unref();

try {
  const resumable = await listResumableBroadcastIds();
  if (resumable.length > 0) {
    console.log('Resuming interrupted broadcasts', { count: resumable.length });
    for (const draftId of resumable) setImmediate(() => void processBroadcast(draftId));
  }
} catch (error) {
  console.error('Broadcast recovery failed', { error: safeOperationalError(error) });
}

try {
  const resumableRecaps = await listResumableRecapIds();
  for (const draftId of resumableRecaps) setImmediate(() => void processRecap(draftId));
} catch (error) {
  console.error('Recap recovery failed', { error: safeOperationalError(error) });
}

async function shutdown(signal) {
  console.log('Webhook shutting down', { signal });
  clearInterval(scheduleTimer);
  clearInterval(recapTimer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
