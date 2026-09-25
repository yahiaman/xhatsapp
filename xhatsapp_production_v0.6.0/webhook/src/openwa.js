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
    sendImage(chatId, { base64, url, mimetype = 'image/jpeg', caption, filename } = {}) {
      return request('send_image', 'POST', '/messages/send-image', {
        chatId,
        base64,
        url,
        mimetype,
        caption,
        filename,
      });
    },
    sendVideo(chatId, { base64, url, mimetype = 'video/mp4', caption, filename } = {}) {
      return request('send_video', 'POST', '/messages/send-video', {
        chatId,
        base64,
        url,
        mimetype,
        caption,
        filename,
      });
    },
    sendDocument(chatId, { base64, url, mimetype = 'application/octet-stream', caption, filename } = {}) {
      return request('send_document', 'POST', '/messages/send-document', {
        chatId,
        base64,
        url,
        mimetype,
        caption,
        filename,
      });
    },
    async downloadMedia(chatId, messageId) {
      const response = await fetch(
        `${root}/api/sessions/${session}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/media`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
          },
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new OpenWaApiError('download_media', response.status, body?.message || body?.error || null);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimetype = response.headers.get('content-type') || 'application/octet-stream';
      return {
        buffer,
        base64: buffer.toString('base64'),
        mimetype,
      };
    },
    deleteMessage(chatId, messageId) {
      return request('delete_message', 'POST', '/messages/delete', {
        chatId,
        messageId,
        forEveryone: true,
      });
    },
    listGroups(limit = 500, offset = 0) {
      return request(
        'list_groups',
        'GET',
        `/groups?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
      );
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
    getMembershipRequests(chatId) {
      return request(
        'get_membership_requests',
        'GET',
        `/groups/${encodeURIComponent(chatId)}/membership-requests`,
      );
    },
    rejectMembershipRequests(chatId, participants) {
      return request(
        'reject_membership_requests',
        'POST',
        `/groups/${encodeURIComponent(chatId)}/membership-requests/reject`,
        {
          participants: Array.isArray(participants) ? participants : [participants],
        },
      );
    },
    approveMembershipRequests(chatId, participants) {
      return request(
        'approve_membership_requests',
        'POST',
        `/groups/${encodeURIComponent(chatId)}/membership-requests/approve`,
        {
          participants: Array.isArray(participants) ? participants : [participants],
        },
      );
    },
    getContact(contactId) {
      return request(
        'get_contact',
        'GET',
        `/contacts/${encodeURIComponent(contactId)}`,
      );
    },
    getSessionStatus() {
      return request('get_session_status', 'GET', '');
    },
    getMe() {
      return request('get_me', 'GET', '/me');
    },
  };
}
