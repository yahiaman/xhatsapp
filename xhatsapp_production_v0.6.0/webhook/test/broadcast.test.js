import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBroadcastPreview,
  buildBroadcastSummary,
  createBroadcastCode,
  parseBroadcastCommand,
  parseCommunicationDraft,
} from '../src/broadcast.js';

test('accepts a communication only when the first line is explicit', () => {
  assert.deepEqual(
    parseCommunicationDraft('COMMUNICATION\nAs-salâm alaykoum\nMessage de test'),
    { text: 'As-salâm alaykoum\nMessage de test' },
  );
  assert.equal(parseCommunicationDraft('Voici une communication'), null);
  assert.deepEqual(parseCommunicationDraft('COMMUNICATION\n'), { error: 'communication_empty' });
});

test('rejects a communication longer than the safe text limit', () => {
  assert.deepEqual(
    parseCommunicationDraft(`COMMUNICATION\n${'a'.repeat(3501)}`),
    { error: 'communication_too_long' },
  );
});

test('parses strict broadcast decisions only', () => {
  assert.deepEqual(parseBroadcastCommand('PUBLIER ABC123'), { action: 'publish', code: 'ABC123' });
  assert.deepEqual(parseBroadcastCommand('annuler ABC123'), { action: 'cancel', code: 'ABC123' });
  assert.deepEqual(parseBroadcastCommand('REESSAYER ABC123'), { action: 'retry', code: 'ABC123' });
  assert.equal(parseBroadcastCommand('OK'), null);
  assert.equal(parseBroadcastCommand('PUBLIER ABC123 maintenant'), null);
});

test('creates an opaque six-character broadcast code', () => {
  assert.match(createBroadcastCode(), /^[A-Z0-9]{6}$/);
});

test('builds a preview with safe group references', () => {
  const preview = buildBroadcastPreview({
    code: 'ABC123',
    text: 'Message public',
    destinations: [{ name: 'Groupe test', reference: '0c5a45d0f8a4' }],
  });
  assert.match(preview, /PUBLIER ABC123/);
  assert.match(preview, /Groupe test/);
  assert.doesNotMatch(preview, /@g\.us/);
});

test('offers a retry only when at least one destination failed', () => {
  assert.doesNotMatch(buildBroadcastSummary({ code: 'ABC123', sent: 2, failed: 0 }), /REESSAYER/);
  assert.match(buildBroadcastSummary({ code: 'ABC123', sent: 1, failed: 1 }), /REESSAYER ABC123/);
});
