import pg from 'pg';
import { safeReference } from './message.js';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', { error: error.message });
});

export async function checkDatabase() {
  await pool.query('SELECT 1');
}

export async function getGroupPolicy(chatId) {
  const result = await pool.query(
    `SELECT id, name, inventory_ref, enabled, is_test, is_admin, is_monitored,
            allow_auto_reply, allow_broadcast, allow_recap
     FROM whatsapp_groups
     WHERE chat_id = $1`,
    [chatId],
  );
  return result.rows[0] || null;
}

export async function getAdminTarget() {
  const result = await pool.query(
    `SELECT id, chat_id, name, inventory_ref
     FROM whatsapp_groups
     WHERE enabled = true AND is_admin = true
     ORDER BY updated_at DESC`,
  );
  if (result.rowCount !== 1) {
    throw new Error(`exactly_one_admin_group_required:${result.rowCount}`);
  }
  return result.rows[0];
}

export async function syncGroupInventory(groups) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let imported = 0;
    for (const group of groups) {
      const chatId = String(group.id || '').trim();
      if (!chatId) continue;
      const name = typeof group.name === 'string' && group.name.trim()
        ? group.name.trim()
        : null;
      await client.query(
        `INSERT INTO whatsapp_groups (
           chat_id, name, inventory_ref, last_seen_at,
           enabled, is_test, is_admin, is_monitored,
           allow_auto_reply, allow_broadcast
         ) VALUES ($1, $2, $3, now(), false, false, false, false, false, false)
         ON CONFLICT (chat_id) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, whatsapp_groups.name),
           inventory_ref = EXCLUDED.inventory_ref,
           last_seen_at = now(),
           updated_at = now()`,
        [chatId, name, safeReference(chatId)],
      );
      imported += 1;
    }
    await client.query('COMMIT');
    return { imported };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function publicGroup(row) {
  return {
    id: row.id,
    name: row.name || '(sans nom)',
    reference: row.inventory_ref || safeReference(row.chat_id),
    enabled: row.enabled,
    isTest: row.is_test,
    isAdmin: row.is_admin,
    isMonitored: row.is_monitored,
    allowAutoReply: row.allow_auto_reply,
    allowBroadcast: row.allow_broadcast,
    allowRecap: row.allow_recap,
    lastSeenAt: row.last_seen_at,
  };
}

export async function listGroupPolicies() {
  const result = await pool.query(
    `SELECT id, chat_id, name, inventory_ref, enabled, is_test, is_admin,
            is_monitored, allow_auto_reply, allow_broadcast, allow_recap, last_seen_at
     FROM whatsapp_groups
     ORDER BY lower(COALESCE(name, '')), inventory_ref`,
  );
  return result.rows.map(publicGroup);
}

export async function updateGroupPolicy(groupId, policy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const beforeResult = await client.query(
      `SELECT id, chat_id, name, inventory_ref, enabled, is_test, is_admin,
              is_monitored, allow_auto_reply, allow_broadcast, allow_recap, last_seen_at
       FROM whatsapp_groups
       WHERE id = $1
       FOR UPDATE`,
      [groupId],
    );
    if (beforeResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      return null;
    }

    const before = beforeResult.rows[0];
    const updatedResult = await client.query(
      `UPDATE whatsapp_groups
       SET enabled = $2,
           is_test = $3,
           is_admin = $4,
           is_monitored = $5,
           allow_auto_reply = $6,
           allow_broadcast = $7,
           allow_recap = $8,
           updated_at = now()
       WHERE id = $1
       RETURNING id, chat_id, name, inventory_ref, enabled, is_test, is_admin,
                 is_monitored, allow_auto_reply, allow_broadcast, allow_recap, last_seen_at`,
      [
        groupId,
        policy.enabled,
        policy.isTest,
        policy.isAdmin,
        policy.isMonitored,
        policy.allowAutoReply,
        policy.allowBroadcast,
        policy.allowRecap,
      ],
    );
    const after = updatedResult.rows[0];
    const auditBefore = publicGroup(before);
    const auditAfter = publicGroup(after);
    delete auditBefore.name;
    delete auditAfter.name;
    await client.query(
      `INSERT INTO group_policy_audit (group_id, previous_policy, new_policy)
       VALUES ($1, $2::jsonb, $3::jsonb)`,
      [groupId, JSON.stringify(auditBefore), JSON.stringify(auditAfter)],
    );
    await client.query('COMMIT');
    return publicGroup(after);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function storeMessage(message, delivery) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO whatsapp_groups (chat_id, name)
       VALUES ($1, $2)
       ON CONFLICT (chat_id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, whatsapp_groups.name),
         updated_at = now()`,
      [message.chatId, message.chatName],
    );

    const result = await client.query(
      `INSERT INTO messages (
         message_id, chat_id, sender_id, sender_name, body,
         from_me, is_group, message_type, received_at,
         event_name, idempotency_key, delivery_id, retry_count
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        message.messageId,
        message.chatId,
        message.senderId,
        message.senderName,
        message.text,
        message.fromMe,
        message.isGroup,
        message.messageType,
        message.receivedAt,
        delivery.eventName,
        delivery.idempotencyKey,
        delivery.deliveryId,
        delivery.retryCount,
      ],
    );

    await client.query('COMMIT');
    return { inserted: result.rowCount === 1, internalId: result.rows[0]?.id ?? null };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createModerationAlert({ messageInternalId, sourceGroupId, detection, code, status = 'pending' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO moderation_alerts (
         code, message_id, source_group_id, categories, matched_terms, status, decided_at
       ) VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'auto_deleted' THEN now() ELSE NULL END)
       ON CONFLICT (message_id) DO NOTHING
       RETURNING id, code, categories, status`,
      [code, messageInternalId, sourceGroupId, detection.categories, detection.matchedTerms, status],
    );
    if (result.rowCount === 1) {
      await client.query(
        `UPDATE messages
         SET processing_status = CASE WHEN $2 = 'auto_deleted' THEN 'auto_deleted' ELSE 'flagged' END, processed_at = now()
         WHERE id = $1`,
        [messageInternalId, status],
      );
    }
    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listForbiddenAgencies() {
  const result = await pool.query(
    `SELECT id, name, normalized_name, created_at
     FROM forbidden_agencies
     ORDER BY lower(name) ASC`,
  );
  return result.rows;
}

export async function addForbiddenAgency(name, normalizedName) {
  const normalized = normalizedName || String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const result = await pool.query(
    `INSERT INTO forbidden_agencies (name, normalized_name)
     VALUES ($1, $2)
     ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, normalized_name, created_at`,
    [name, normalized],
  );
  return result.rows[0];
}

export async function deleteForbiddenAgency(id) {
  const result = await pool.query(
    `DELETE FROM forbidden_agencies WHERE id = $1 RETURNING id, name`,
    [id],
  );
  return result.rows[0] || null;
}

export async function listModerationKeywords(category) {
  const query = category
    ? 'SELECT id, category, term, created_at FROM moderation_keywords WHERE category = $1 ORDER BY lower(term) ASC'
    : 'SELECT id, category, term, created_at FROM moderation_keywords ORDER BY category, lower(term) ASC';
  const params = category ? [category] : [];
  const result = await pool.query(query, params);
  return result.rows;
}

export async function addModerationKeyword(category, term) {
  const result = await pool.query(
    `INSERT INTO moderation_keywords (category, term)
     VALUES ($1, $2)
     ON CONFLICT (category, term) DO UPDATE SET term = EXCLUDED.term
     RETURNING id, category, term, created_at`,
    [category, term],
  );
  return result.rows[0];
}

export async function deleteModerationKeyword(id) {
  const result = await pool.query(
    `DELETE FROM moderation_keywords WHERE id = $1 RETURNING id, category, term`,
    [id],
  );
  return result.rows[0] || null;
}

export async function markModerationAlertNotified(alertId, adminMessageId) {
  await pool.query(
    `UPDATE moderation_alerts
     SET admin_alert_message_id = $2, alerted_at = now(), last_error = NULL
     WHERE id = $1 AND status = 'pending'`,
    [alertId, adminMessageId || null],
  );
}

export async function recordModerationAlertError(alertId, safeError) {
  await pool.query(
    `UPDATE moderation_alerts
     SET last_error = left($2, 500)
     WHERE id = $1 AND status = 'pending'`,
    [alertId, safeError],
  );
}

export async function getPendingModerationAlert(code) {
  const result = await pool.query(
    `SELECT a.id, a.code, a.categories, a.created_at,
            m.id AS message_internal_id, m.message_id, m.chat_id,
            g.name AS group_name, g.inventory_ref AS group_reference
     FROM moderation_alerts a
     JOIN messages m ON m.id = a.message_id
     JOIN whatsapp_groups g ON g.id = a.source_group_id
     WHERE a.code = $1 AND a.status = 'pending'`,
    [code],
  );
  return result.rows[0] || null;
}

export async function resolveModerationAlert({ code, status, decisionMessageId, decisionByRef }) {
  if (!['ignored', 'deleted'].includes(status)) throw new Error('invalid_moderation_status');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const alert = await client.query(
      `SELECT id, message_id
       FROM moderation_alerts
       WHERE code = $1 AND status = 'pending'
       FOR UPDATE`,
      [code],
    );
    if (alert.rowCount !== 1) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `UPDATE moderation_alerts
       SET status = $2, decision_message_id = $3, decision_by_ref = $4,
           decided_at = now(), last_error = NULL
       WHERE id = $1`,
      [alert.rows[0].id, status, decisionMessageId, decisionByRef],
    );
    await client.query(
      `UPDATE messages
       SET processing_status = $2, processed_at = now()
       WHERE id = $1`,
      [alert.rows[0].message_id, status === 'deleted' ? 'deleted' : 'moderation_ignored'],
    );
    await client.query('COMMIT');
    return { id: alert.rows[0].id, code, status };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listModerationAlerts(limit = 100) {
  const result = await pool.query(
    `SELECT a.code, a.categories, a.status, a.created_at, a.alerted_at,
            a.decided_at, a.last_error,
            COALESCE(g.name, '(sans nom)') AS group_name,
            COALESCE(g.inventory_ref, left(encode(digest(g.chat_id, 'sha256'), 'hex'), 12)) AS group_reference
     FROM moderation_alerts a
     JOIN whatsapp_groups g ON g.id = a.source_group_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 100, 500))],
  );
  return result.rows.map((row) => ({
    code: row.code,
    categories: row.categories,
    status: row.status,
    groupName: row.group_name,
    groupReference: row.group_reference || safeReference(row.chat_id),
    createdAt: row.created_at,
    alertedAt: row.alerted_at,
    decidedAt: row.decided_at,
    error: row.last_error,
  }));
}

export async function createBroadcastDraft({
  code,
  sourceMessageId,
  adminGroupId,
  body,
  createdByRef,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const targets = await client.query(
      `SELECT id, chat_id, name, inventory_ref
       FROM whatsapp_groups
       WHERE enabled = true
         AND allow_broadcast = true
         AND is_admin = false
       ORDER BY lower(COALESCE(name, '')), inventory_ref
       FOR SHARE`,
    );
    if (targets.rowCount === 0) throw new Error('no_broadcast_targets');

    const draft = await client.query(
      `INSERT INTO broadcast_drafts (
         code, source_message_id, admin_group_id, body, created_by_ref
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_message_id) DO NOTHING
       RETURNING id, code, body, status, created_at`,
      [code, sourceMessageId, adminGroupId, body, createdByRef],
    );
    if (draft.rowCount !== 1) {
      await client.query('ROLLBACK');
      return null;
    }
    for (const target of targets.rows) {
      await client.query(
        `INSERT INTO broadcast_deliveries (draft_id, group_id)
         VALUES ($1, $2)`,
        [draft.rows[0].id, target.id],
      );
    }
    await client.query('COMMIT');
    return {
      ...draft.rows[0],
      destinations: targets.rows.map((row) => ({
        name: row.name || '(sans nom)',
        reference: row.inventory_ref || safeReference(row.chat_id),
      })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordBroadcastDraftError(draftId, safeError) {
  await pool.query(
    `UPDATE broadcast_drafts
     SET last_error = left($2, 500)
     WHERE id = $1`,
    [draftId, safeError],
  );
}

export async function cancelBroadcastDraft({ code, decisionMessageId, decisionByRef }) {
  const result = await pool.query(
    `UPDATE broadcast_drafts
     SET status = 'cancelled', decision_message_id = $2,
         decision_by_ref = $3, decided_at = now(), completed_at = now(),
         last_error = NULL
     WHERE code = $1 AND status = 'pending'
     RETURNING id, code, status`,
    [code, decisionMessageId, decisionByRef],
  );
  return result.rows[0] || null;
}

export async function claimBroadcastDraft({ code, action, decisionMessageId, decisionByRef }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expectedStatus = action === 'retry' ? 'partial_failed' : 'pending';
    const result = await client.query(
      `SELECT id, code
       FROM broadcast_drafts
       WHERE code = $1 AND status = $2
       FOR UPDATE`,
      [code, expectedStatus],
    );
    if (result.rowCount !== 1) {
      await client.query('ROLLBACK');
      return null;
    }
    if (action === 'retry') {
      await client.query(
        `UPDATE broadcast_deliveries
         SET status = 'pending', last_error = NULL
         WHERE draft_id = $1 AND status = 'failed'`,
        [result.rows[0].id],
      );
    }
    await client.query(
      `UPDATE broadcast_drafts
       SET status = 'publishing', decision_message_id = $2,
           decision_by_ref = $3, decided_at = now(), completed_at = NULL,
           last_error = NULL
       WHERE id = $1`,
      [result.rows[0].id, decisionMessageId, decisionByRef],
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listResumableBroadcastIds() {
  const result = await pool.query(
    `SELECT id FROM broadcast_drafts WHERE status = 'publishing' ORDER BY created_at`,
  );
  return result.rows.map((row) => row.id);
}

export async function getBroadcastExecution(draftId) {
  const draft = await pool.query(
    `SELECT d.id, d.code, d.body, g.chat_id AS admin_chat_id
     FROM broadcast_drafts d
     JOIN whatsapp_groups g ON g.id = d.admin_group_id
     WHERE d.id = $1 AND d.status = 'publishing'`,
    [draftId],
  );
  if (draft.rowCount !== 1) return null;
  const deliveries = await pool.query(
    `SELECT bd.id, bd.status, g.chat_id, g.name, g.inventory_ref
     FROM broadcast_deliveries bd
     JOIN whatsapp_groups g ON g.id = bd.group_id
     WHERE bd.draft_id = $1 AND bd.status <> 'sent'
     ORDER BY lower(COALESCE(g.name, '')), g.inventory_ref`,
    [draftId],
  );
  return { ...draft.rows[0], deliveries: deliveries.rows };
}

export async function markBroadcastDeliverySending(deliveryId) {
  const result = await pool.query(
    `UPDATE broadcast_deliveries
     SET status = 'sending', attempts = attempts + 1, started_at = now(), last_error = NULL
     WHERE id = $1 AND status <> 'sent'
     RETURNING id`,
    [deliveryId],
  );
  return result.rowCount === 1;
}

export async function markBroadcastDeliverySent(deliveryId, openWaMessageId) {
  await pool.query(
    `UPDATE broadcast_deliveries
     SET status = 'sent', openwa_message_id = $2, sent_at = now(), last_error = NULL
     WHERE id = $1`,
    [deliveryId, openWaMessageId || null],
  );
}

export async function markBroadcastDeliveryFailed(deliveryId, safeError) {
  await pool.query(
    `UPDATE broadcast_deliveries
     SET status = 'failed', last_error = left($2, 500)
     WHERE id = $1`,
    [deliveryId, safeError],
  );
}

export async function finalizeBroadcastDraft(draftId) {
  const result = await pool.query(
    `WITH counts AS (
       SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent,
              count(*) FILTER (WHERE status = 'failed')::int AS failed,
              count(*) FILTER (WHERE status IN ('pending', 'sending'))::int AS remaining
       FROM broadcast_deliveries
       WHERE draft_id = $1
     )
     UPDATE broadcast_drafts d
     SET status = CASE
           WHEN counts.failed = 0 AND counts.remaining = 0 THEN 'published'
           ELSE 'partial_failed'
         END,
         completed_at = now(),
         last_error = CASE WHEN counts.failed > 0 THEN 'one_or_more_deliveries_failed' ELSE NULL END
     FROM counts
     WHERE d.id = $1
     RETURNING d.code, d.status, counts.sent, counts.failed, counts.remaining`,
    [draftId],
  );
  return result.rows[0] || null;
}

export async function listBroadcastDrafts(limit = 100) {
  const result = await pool.query(
    `SELECT d.code, d.status, d.created_at, d.decided_at, d.completed_at,
            count(bd.id)::int AS destinations,
            count(bd.id) FILTER (WHERE bd.status = 'sent')::int AS sent,
            count(bd.id) FILTER (WHERE bd.status = 'failed')::int AS failed
     FROM broadcast_drafts d
     LEFT JOIN broadcast_deliveries bd ON bd.draft_id = d.id
     GROUP BY d.id
     ORDER BY d.created_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 100, 500))],
  );
  return result.rows.map((row) => ({
    code: row.code,
    status: row.status,
    destinations: row.destinations,
    sent: row.sent,
    failed: row.failed,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    completedAt: row.completed_at,
  }));
}

function publicSchedule(row) {
  return {
    groupId: row.group_id,
    groupName: row.group_name || '(sans nom)',
    groupReference: row.group_reference,
    groupEnabled: row.group_enabled,
    enabled: row.schedule_enabled ?? false,
    timezone: row.timezone || 'Europe/Paris',
    weekdays: row.weekdays || [1, 2, 3, 4, 5, 6, 7],
    openTime: String(row.open_time || '08:00').slice(0, 5),
    closeTime: String(row.close_time || '22:00').slice(0, 5),
    openMessage: row.open_message || 'Bonjour, le groupe est maintenant ouvert aux échanges.',
    closeMessage: row.close_message || 'Le groupe ferme maintenant. Merci pour vos échanges.',
    updatedAt: row.schedule_updated_at || null,
  };
}

export async function listGroupSchedules({ enabledOnly = false } = {}) {
  const result = await pool.query(
    `SELECT g.id AS group_id, g.name AS group_name, g.inventory_ref AS group_reference,
            g.enabled AS group_enabled, s.enabled AS schedule_enabled, s.timezone,
            s.weekdays, s.open_time, s.close_time, s.open_message, s.close_message,
            s.updated_at AS schedule_updated_at, g.chat_id
     FROM whatsapp_groups g
     LEFT JOIN group_schedules s ON s.group_id = g.id
     WHERE g.is_admin = false
       AND ($1::boolean = false OR (g.enabled = true AND s.enabled = true))
     ORDER BY lower(COALESCE(g.name, '')), g.inventory_ref`,
    [enabledOnly],
  );
  return result.rows.map((row) => ({ ...publicSchedule(row), chatId: row.chat_id }));
}

export async function updateGroupSchedule(groupId, schedule) {
  const result = await pool.query(
    `INSERT INTO group_schedules (
       group_id, enabled, timezone, weekdays, open_time, close_time,
       open_message, close_message, updated_at
     )
     SELECT id, $2, $3, $4::smallint[], $5::time, $6::time, $7, $8, now()
     FROM whatsapp_groups
     WHERE id = $1 AND is_admin = false AND ($2::boolean = false OR enabled = true)
     ON CONFLICT (group_id) DO UPDATE SET
       enabled = EXCLUDED.enabled, timezone = EXCLUDED.timezone,
       weekdays = EXCLUDED.weekdays, open_time = EXCLUDED.open_time,
       close_time = EXCLUDED.close_time, open_message = EXCLUDED.open_message,
       close_message = EXCLUDED.close_message, updated_at = now()
     RETURNING group_id`,
    [
      groupId, schedule.enabled, schedule.timezone, schedule.weekdays,
      schedule.openTime, schedule.closeTime, schedule.openMessage, schedule.closeMessage,
    ],
  );
  if (result.rowCount !== 1) return null;
  const schedules = await listGroupSchedules();
  return schedules.find((item) => item.groupId === groupId) || null;
}

export async function getScheduleTarget(groupId) {
  const result = await pool.query(
    `SELECT g.id, g.chat_id, g.name, g.inventory_ref, g.enabled,
            s.enabled AS schedule_enabled
     FROM whatsapp_groups g
     LEFT JOIN group_schedules s ON s.group_id = g.id
     WHERE g.id = $1 AND g.is_admin = false`,
    [groupId],
  );
  return result.rows[0] || null;
}

export async function claimScheduleRun({ groupId, action, localDate }) {
  const result = await pool.query(
    `INSERT INTO schedule_runs (group_id, action, local_date)
     VALUES ($1, $2, $3::date)
     ON CONFLICT (group_id, action, local_date) DO UPDATE SET
       status = 'running', attempts = schedule_runs.attempts + 1,
       last_error = NULL, started_at = now(), completed_at = NULL, updated_at = now()
     WHERE schedule_runs.status IN ('failed', 'partial_failed')
       AND schedule_runs.attempts < 3
       AND schedule_runs.updated_at < now() - interval '60 seconds'
     RETURNING id, attempts, message_status, settings_status, openwa_message_id`,
    [groupId, action, localDate],
  );
  return result.rows[0] || null;
}

export async function finishScheduleRun({
  runId, status, messageStatus, settingsStatus, openWaMessageId, safeError,
}) {
  await pool.query(
    `UPDATE schedule_runs
     SET status = $2, message_status = $3, settings_status = $4,
         openwa_message_id = $5, last_error = left($6, 500),
         completed_at = now(), updated_at = now()
     WHERE id = $1`,
    [runId, status, messageStatus, settingsStatus, openWaMessageId || null, safeError || null],
  );
}

export async function listScheduleRuns(limit = 100) {
  const result = await pool.query(
    `SELECT r.action, r.local_date, r.status, r.attempts, r.message_status,
            r.settings_status, r.last_error, r.started_at, r.completed_at,
            COALESCE(g.name, '(sans nom)') AS group_name,
            COALESCE(g.inventory_ref, left(encode(digest(g.chat_id, 'sha256'), 'hex'), 12)) AS group_reference
     FROM schedule_runs r
     JOIN whatsapp_groups g ON g.id = r.group_id
     ORDER BY r.started_at DESC
     LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 100, 500))],
  );
  return result.rows.map((row) => ({
    action: row.action, localDate: row.local_date, status: row.status,
    attempts: row.attempts, messageStatus: row.message_status,
    settingsStatus: row.settings_status, error: row.last_error,
    groupName: row.group_name, groupReference: row.group_reference,
    startedAt: row.started_at, completedAt: row.completed_at,
  }));
}

export async function getRecapSettings() {
  const result = await pool.query(
    `SELECT timezone, to_char(run_time, 'HH24:MI') AS run_time, signature, updated_at
     FROM recap_settings WHERE singleton = true`,
  );
  const row = result.rows[0];
  return {
    timezone: row?.timezone || 'Europe/Paris',
    runTime: row?.run_time || '20:10',
    signature: row?.signature || '',
    updatedAt: row?.updated_at || null,
  };
}

export async function updateRecapSettings({ signature }) {
  const result = await pool.query(
    `UPDATE recap_settings
     SET signature = $1, updated_at = now()
     WHERE singleton = true
     RETURNING timezone, to_char(run_time, 'HH24:MI') AS run_time, signature, updated_at`,
    [signature],
  );
  const row = result.rows[0];
  return { timezone: row.timezone, runTime: row.run_time, signature: row.signature, updatedAt: row.updated_at };
}

export async function claimDailyRecap({ code, localDate }) {
  const result = await pool.query(
    `INSERT INTO recap_drafts (code, local_date)
     VALUES ($1, $2::date)
     ON CONFLICT (local_date) DO UPDATE SET
       status = 'generating', attempts = recap_drafts.attempts + 1,
       last_error = NULL, updated_at = now(), completed_at = NULL
     WHERE recap_drafts.status = 'failed'
       AND recap_drafts.attempts < 3
       AND recap_drafts.updated_at < now() - interval '5 minutes'
     RETURNING id, code, local_date, attempts`,
    [code, localDate],
  );
  return result.rows[0] || null;
}

export async function listRecapSourceGroups(localDate, timezone) {
  const result = await pool.query(
    `SELECT g.id, g.chat_id, COALESCE(g.name, '(sans nom)') AS name,
            COALESCE(g.inventory_ref, left(encode(digest(g.chat_id, 'sha256'), 'hex'), 12)) AS reference,
            json_agg(json_build_object(
              'time', to_char(m.received_at AT TIME ZONE $2, 'HH24:MI'),
              'body', m.body
            ) ORDER BY m.received_at) AS messages
     FROM whatsapp_groups g
     JOIN messages m ON m.chat_id = g.chat_id
     WHERE g.enabled = true AND g.is_admin = false AND g.allow_recap = true
       AND m.is_group = true AND m.from_me = false
       AND m.body IS NOT NULL AND btrim(m.body) <> ''
       AND (m.received_at AT TIME ZONE $2)::date = $1::date
     GROUP BY g.id
     ORDER BY lower(COALESCE(g.name, '')), g.inventory_ref`,
    [localDate, timezone],
  );
  return result.rows;
}

export async function listRecapTargetGroups() {
  const result = await pool.query(
    `SELECT g.id, g.chat_id, COALESCE(g.name, '(sans nom)') AS name,
            COALESCE(g.inventory_ref, left(encode(digest(g.chat_id, 'sha256'), 'hex'), 12)) AS reference
     FROM whatsapp_groups g
     WHERE g.enabled = true AND g.is_admin = false AND g.allow_recap = true
     ORDER BY lower(COALESCE(g.name, '')), g.inventory_ref`,
  );
  return result.rows;
}

export async function listConsolidatedRecapMessages(localDate, timezone) {
  const result = await pool.query(
    `SELECT to_char(m.received_at AT TIME ZONE $2, 'HH24:MI') AS time,
            COALESCE(g.name, '(sans nom)') AS group_name,
            m.body
     FROM messages m
     JOIN whatsapp_groups g ON g.chat_id = m.chat_id
     WHERE g.enabled = true AND g.is_admin = false AND g.allow_recap = true
       AND m.is_group = true AND m.from_me = false
       AND m.body IS NOT NULL AND btrim(m.body) <> ''
       AND (m.received_at AT TIME ZONE $2)::date = $1::date
     ORDER BY m.received_at ASC`,
    [localDate, timezone],
  );
  return result.rows;
}

export async function finishRecapGeneration({ draftId, deliveries }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const delivery of deliveries) {
      await client.query(
        `INSERT INTO recap_deliveries (draft_id, group_id, body, message_count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (draft_id, group_id) DO UPDATE SET
           body = EXCLUDED.body, message_count = EXCLUDED.message_count`,
        [draftId, delivery.groupId, delivery.body, delivery.messageCount],
      );
    }
    await client.query(
      `UPDATE recap_drafts SET status = $2, updated_at = now(), completed_at = CASE WHEN $2 = 'empty' THEN now() ELSE NULL END
       WHERE id = $1 AND status = 'generating'`,
      [draftId, deliveries.length ? 'pending' : 'empty'],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function failRecapGeneration(draftId, safeError) {
  await pool.query(
    `UPDATE recap_drafts SET status = 'failed', last_error = left($2, 500), updated_at = now(), completed_at = now()
     WHERE id = $1`,
    [draftId, safeError],
  );
}

export async function getRecapPreview(draftId) {
  const result = await pool.query(
    `SELECT d.id, d.code, d.local_date, rd.body, rd.message_count,
            g.name, g.inventory_ref AS reference
     FROM recap_drafts d
     JOIN recap_deliveries rd ON rd.draft_id = d.id
     JOIN whatsapp_groups g ON g.id = rd.group_id
     WHERE d.id = $1
     ORDER BY lower(COALESCE(g.name, '')), g.inventory_ref`,
    [draftId],
  );
  if (!result.rowCount) return null;
  return {
    id: result.rows[0].id, code: result.rows[0].code, localDate: result.rows[0].local_date,
    deliveries: result.rows.map((row) => ({
      name: row.name || '(sans nom)', reference: row.reference,
      messageCount: row.message_count, body: row.body,
    })),
  };
}

export async function cancelRecapDraft({ code, decisionMessageId, decisionByRef }) {
  const result = await pool.query(
    `UPDATE recap_drafts SET status = 'cancelled', decision_message_id = $2,
       decision_by_ref = $3, decided_at = now(), completed_at = now(), updated_at = now(), last_error = NULL
     WHERE code = $1 AND status = 'pending' RETURNING id, code`,
    [code, decisionMessageId, decisionByRef],
  );
  return result.rows[0] || null;
}

export async function claimRecapDraft({ code, action, decisionMessageId, decisionByRef }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expected = action === 'retry' ? 'partial_failed' : 'pending';
    const result = await client.query(
      `SELECT id, code FROM recap_drafts WHERE code = $1 AND status = $2 FOR UPDATE`,
      [code, expected],
    );
    if (!result.rowCount) { await client.query('ROLLBACK'); return null; }
    if (action === 'retry') {
      await client.query(
        `UPDATE recap_deliveries SET status = 'pending', last_error = NULL
         WHERE draft_id = $1 AND status = 'failed'`,
        [result.rows[0].id],
      );
    }
    await client.query(
      `UPDATE recap_drafts SET status = 'publishing', decision_message_id = $2,
       decision_by_ref = $3, decided_at = now(), completed_at = NULL, updated_at = now(), last_error = NULL
       WHERE id = $1`,
      [result.rows[0].id, decisionMessageId, decisionByRef],
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function getRecapExecution(draftId) {
  const draft = await pool.query(
    `SELECT d.id, d.code, g.chat_id AS admin_chat_id FROM recap_drafts d
     CROSS JOIN LATERAL (
       SELECT chat_id FROM whatsapp_groups WHERE enabled = true AND is_admin = true LIMIT 1
     ) g WHERE d.id = $1 AND d.status = 'publishing'`,
    [draftId],
  );
  if (!draft.rowCount) return null;
  const deliveries = await pool.query(
    `SELECT rd.id, rd.body, g.chat_id, g.name, g.inventory_ref
     FROM recap_deliveries rd JOIN whatsapp_groups g ON g.id = rd.group_id
     WHERE rd.draft_id = $1 AND rd.status <> 'sent'
     ORDER BY lower(COALESCE(g.name, '')), g.inventory_ref`,
    [draftId],
  );
  return { ...draft.rows[0], deliveries: deliveries.rows };
}

export async function markRecapDeliverySending(deliveryId) {
  const result = await pool.query(
    `UPDATE recap_deliveries SET status = 'sending', attempts = attempts + 1,
       started_at = now(), last_error = NULL WHERE id = $1 AND status <> 'sent' RETURNING id`,
    [deliveryId],
  );
  return result.rowCount === 1;
}

export async function markRecapDeliverySent(deliveryId, openWaMessageId) {
  await pool.query(
    `UPDATE recap_deliveries SET status = 'sent', openwa_message_id = $2, sent_at = now(), last_error = NULL WHERE id = $1`,
    [deliveryId, openWaMessageId || null],
  );
}

export async function markRecapDeliveryFailed(deliveryId, safeError) {
  await pool.query(
    `UPDATE recap_deliveries SET status = 'failed', last_error = left($2, 500) WHERE id = $1`,
    [deliveryId, safeError],
  );
}

export async function finalizeRecapDraft(draftId) {
  const result = await pool.query(
    `WITH counts AS (
       SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent,
              count(*) FILTER (WHERE status = 'failed')::int AS failed,
              count(*) FILTER (WHERE status IN ('pending','sending'))::int AS remaining
       FROM recap_deliveries WHERE draft_id = $1
     ) UPDATE recap_drafts d SET
       status = CASE WHEN counts.failed = 0 AND counts.remaining = 0 THEN 'published' ELSE 'partial_failed' END,
       completed_at = now(), updated_at = now(),
       last_error = CASE WHEN counts.failed > 0 THEN 'one_or_more_deliveries_failed' ELSE NULL END
     FROM counts WHERE d.id = $1 RETURNING d.code, d.status, counts.sent, counts.failed`,
    [draftId],
  );
  return result.rows[0] || null;
}

export async function listResumableRecapIds() {
  const result = await pool.query(`SELECT id FROM recap_drafts WHERE status = 'publishing' ORDER BY created_at`);
  return result.rows.map((row) => row.id);
}

export async function listRecapDrafts(limit = 100) {
  const result = await pool.query(
    `SELECT d.code, d.local_date, d.status, d.attempts, d.created_at, d.decided_at, d.completed_at,
       count(rd.id)::int AS destinations,
       count(rd.id) FILTER (WHERE rd.status='sent')::int AS sent,
       count(rd.id) FILTER (WHERE rd.status='failed')::int AS failed
     FROM recap_drafts d LEFT JOIN recap_deliveries rd ON rd.draft_id=d.id
     GROUP BY d.id ORDER BY d.local_date DESC LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 100, 500))],
  );
  return result.rows;
}
