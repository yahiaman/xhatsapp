import assert from 'node:assert/strict';
import test from 'node:test';
import { decideMessagePolicy } from '../src/policy.js';

test('rejects private conversations before storage', () => {
  assert.deepEqual(decideMessagePolicy({ isGroup: false }, null), { allowed: false, reason: 'private_chat' });
});

test('rejects an unknown or disabled group', () => {
  assert.deepEqual(decideMessagePolicy({ isGroup: true }, null), { allowed: false, reason: 'chat_not_allowed' });
  assert.deepEqual(
    decideMessagePolicy({ isGroup: true }, { enabled: false, is_test: true }),
    { allowed: false, reason: 'chat_not_allowed' },
  );
});

test('rejects an enabled group without an incoming role', () => {
  assert.deepEqual(
    decideMessagePolicy(
      { isGroup: true },
      { enabled: true, is_test: false, is_admin: false, is_monitored: false },
    ),
    { allowed: false, reason: 'chat_not_allowed' },
  );
});

test('accepts enabled test, monitored and admin groups', () => {
  for (const role of ['is_test', 'is_monitored', 'is_admin']) {
    const policy = { enabled: true, is_test: false, is_monitored: false, is_admin: false, [role]: true };
    assert.deepEqual(decideMessagePolicy({ isGroup: true }, policy), { allowed: true, reason: null });
  }
});
