import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendSignature, buildRecapPreview, createSummaryClient, localDateAndTime,
  parseRecapCommand, recapIsDue, splitMessages,
} from '../src/recap.js';

test('parses only explicit recap commands with a code', () => {
  assert.deepEqual(parseRecapCommand('GO RECAP ABC234'), { action: 'publish', code: 'ABC234' });
  assert.deepEqual(parseRecapCommand('annuler recap ABC234'), { action: 'cancel', code: 'ABC234' });
  assert.equal(parseRecapCommand('go'), null);
  assert.equal(parseRecapCommand('GO RECAP ABC'), null);
});

test('calls OmniRoute through its OpenAI-compatible endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Résumé français' } }] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const client = createSummaryClient({
      provider: 'omniroute', baseUrl: 'http://omniroute:20128/v1/',
      apiKey: 'test-key-never-logged', model: 'provider/model', timeoutMs: 1_000,
    });
    assert.equal(await client.generate('Contenu', 250), 'Résumé français');
    assert.equal(captured.url, 'http://omniroute:20128/v1/chat/completions');
    assert.equal(captured.options.headers.Authorization, 'Bearer test-key-never-logged');
    assert.equal(JSON.parse(captured.options.body).model, 'provider/model');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('refuses an unconfigured OmniRoute endpoint', async () => {
  const client = createSummaryClient({
    provider: 'omniroute', baseUrl: 'http://omniroute:20128/v1',
    apiKey: 'pending', model: 'pending',
  });
  await assert.rejects(() => client.generate('Contenu', 100), /summary_model_not_configured/);
});

test('computes Paris date and due state', () => {
  const before = new Date('2026-09-02T18:09:00Z');
  const after = new Date('2026-09-02T18:10:00Z');
  assert.deepEqual(localDateAndTime(after), { localDate: '2026-09-02', localTime: '20:10' });
  assert.equal(recapIsDue({ timezone: 'Europe/Paris', runTime: '20:10' }, before), null);
  assert.equal(recapIsDue({ timezone: 'Europe/Paris', runTime: '20:10' }, after), '2026-09-02');
});

test('chunks messages and appends the configured signature', () => {
  const chunks = splitMessages([
    { time: '10:00', body: 'A'.repeat(20) },
    { time: '10:01', body: 'B'.repeat(20) },
  ], 30);
  assert.equal(chunks.length, 2);
  assert.equal(appendSignature('Résumé', 'Signature'), 'Résumé\n\nSignature');
});

test('builds a guarded preview', () => {
  const text = buildRecapPreview({
    code: 'ABC234', localDate: '2026-09-02',
    deliveries: [{ name: 'Groupe 1', reference: 'ref123', messageCount: 8 }],
  });
  assert.match(text, /GO RECAP ABC234/);
  assert.match(text, /8 message/);
});
