import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyOpenWaSignature } from '../src/security.js';

test('accepts an exact OpenWA HMAC-SHA256 signature', () => {
  const body = Buffer.from('{"event":"message.received"}');
  const secret = 'test-secret';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifyOpenWaSignature(body, signature, secret), true);
});

test('rejects a modified signature', () => {
  const body = Buffer.from('{"event":"message.received"}');
  assert.equal(verifyOpenWaSignature(body, 'sha256=bad', 'test-secret'), false);
});
