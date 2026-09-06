import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgency, parsePolicy, validAdminToken } from '../src/admin.js';

const completePolicy = {
  enabled: true,
  isTest: true,
  isAdmin: false,
  isMonitored: false,
  allowAutoReply: false,
  allowBroadcast: false,
  allowRecap: false,
};

test('validates the Xhatsapp admin token exactly', () => {
  assert.equal(validAdminToken('secret', 'secret'), true);
  assert.equal(validAdminToken('changed', 'secret'), false);
  assert.equal(validAdminToken('', 'secret'), false);
});

test('requires every group policy boolean', () => {
  assert.deepEqual(parsePolicy(completePolicy), completePolicy);
  assert.equal(parsePolicy({ enabled: true }), null);
});

test('requires confirmation for automatic group actions', () => {
  assert.deepEqual(parsePolicy({ ...completePolicy, allowAutoReply: true }), { confirmationRequired: true });
  assert.equal(parsePolicy({ ...completePolicy, allowBroadcast: true, confirm: true }).allowBroadcast, true);
  assert.deepEqual(parsePolicy({ ...completePolicy, allowRecap: true }), { confirmationRequired: true });
});

test('parses and validates agency input', () => {
  assert.deepEqual(parseAgency({ name: '  Al Bouraq Voyages  ' }), { name: 'Al Bouraq Voyages' });
  assert.equal(parseAgency({ name: '' }), null);
  assert.equal(parseAgency({ name: '   ' }), null);
  assert.equal(parseAgency({}), null);
  assert.equal(parseAgency(null), null);
  assert.equal(parseAgency({ name: 'A'.repeat(151) }), null);
});
