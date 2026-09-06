export class OpenWaApiError extends Error {
  constructor(operation, status, detail) {
    super(`OpenWA ${operation} failed with HTTP ${status}`);
    this.name = 'OpenWaApiError';
    this.operation = operation;
    this.status = status;
    this.detail = detail;
  }
}

export function createOpenWaClient({ baseUrl, sessionId, apiKey, timeoutMs = 30_000 }) {
  if (!baseUrl || !sessionId || !apiKey) {
    throw new Error('OpenWA client configuration is incomplete');
  }
  const root = String(baseUrl).replace(/\/+$/, '');
  const session = encodeURIComponent(sessionId);

  async function request(operation, method, path, payload) {
    const response = await fetch(`${root}/api/sessions/${session}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new OpenWaApiError(operation, response.status, body?.message || body?.error || null);
    }
    return body;
  }

  return {
    sendText(chatId, text) {
      return request('send_text', 'POST', '/messages/send-text', { chatId, text });
    },
    deleteMessage(chatId, messageId) {
      return request('delete_message', 'POST', '/messages/delete', {
        chatId,
        messageId,
        forEveryone: true,
      });
    },
    getGroup(chatId) {
      return request(
        'get_group',
        'GET',
        `/groups/${encodeURIComponent(chatId)}`,
      );
    },
    removeParticipants(chatId, participants) {
      return request(
        'remove_participants',
        'DELETE',
        `/groups/${encodeURIComponent(chatId)}/participants`,
        {
          participants: Array.isArray(participants) ? participants : [participants],
        },
      );
    },
    getGroupSettings(chatId) {
      return request(
        'get_group_settings',
        'GET',
        `/groups/${encodeURIComponent(chatId)}/settings`,
      );
    },
    updateGroupSettings(chatId, settings) {
      return request(
        'update_group_settings',
        'PUT',
        `/groups/${encodeURIComponent(chatId)}/settings`,
        settings,
      );
    },
  };
}
