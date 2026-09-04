import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpenWaClient, OpenWaApiError } from '../src/openwa.js';

test('sends text with the official OpenWA route and payload', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ messageId: 'sent-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const client = createOpenWaClient({
    baseUrl: 'http://openwa:2785',
    sessionId: 'session id',
    apiKey: 'secret-key',
  });
  await client.sendText('group@g.us', 'Alerte');
  assert.equal(captured.url, 'http://openwa:2785/api/sessions/session%20id/messages/send-text');
  assert.deepEqual(JSON.parse(captured.options.body), { chatId: 'group@g.us', text: 'Alerte' });
  assert.equal(captured.options.headers['X-API-Key'], 'secret-key');
});

test('deletes for everyone with the official OpenWA payload', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let payload;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const client = createOpenWaClient({ baseUrl: 'http://openwa:2785', sessionId: 's', apiKey: 'k' });
  await client.deleteMessage('group@g.us', 'message-1');
  assert.deepEqual(payload, {
    chatId: 'group@g.us',
    messageId: 'message-1',
    forEveryone: true,
  });
});

test('raises a typed error without leaking the API key', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'refused' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
  const client = createOpenWaClient({ baseUrl: 'http://openwa:2785', sessionId: 's', apiKey: 'top-secret' });
  await assert.rejects(
    () => client.deleteMessage('g', 'm'),
    (error) => error instanceof OpenWaApiError
      && error.status === 403
      && !error.message.includes('top-secret'),
  );
});

test('reads and updates group settings with encoded group ids', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ announce: options.method === 'PUT' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  const client = createOpenWaClient({ baseUrl: 'http://openwa:2785', sessionId: 's', apiKey: 'k' });
  await client.getGroupSettings('123@g.us');
  await client.updateGroupSettings('123@g.us', { announce: true });
  assert.equal(calls[0].url, 'http://openwa:2785/api/sessions/s/groups/123%40g.us/settings');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1].options.body), { announce: true });
});
