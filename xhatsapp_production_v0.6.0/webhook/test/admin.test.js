import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgency, parseKeyword, parseModeratorInput, parsePolicy, validAdminToken } from '../src/admin.js';

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

test('parses and validates keyword input', () => {
  assert.deepEqual(parseKeyword({ category: 'donation', term: '  cagnotte-test  ' }), {
    category: 'donation',
    term: 'cagnotte-test',
  });
  assert.deepEqual(parseKeyword({ category: 'ADVERTISING', term: 'promo2026' }), {
    category: 'advertising',
    term: 'promo2026',
  });
  assert.equal(parseKeyword({ category: 'invalid', term: 'quelque chose' }), null);
  assert.equal(parseKeyword({ category: 'donation', term: '' }), null);
  assert.equal(parseKeyword({ category: 'donation', term: '   ' }), null);
  assert.equal(parseKeyword({ category: 'donation', term: 'A'.repeat(151) }), null);
  assert.equal(parseKeyword(null), null);
});

test('parses and validates moderator input', () => {
  assert.deepEqual(parseModeratorInput({ phone: ' +33 6 12 34 56 78 ', label: '  Yahia Coordinateur  ' }), {
    phone: '+33 6 12 34 56 78',
    label: 'Yahia Coordinateur',
  });
  assert.deepEqual(parseModeratorInput({ phone: '0612345678' }), {
    phone: '0612345678',
    label: null,
  });
  assert.equal(parseModeratorInput({ phone: '123' }), null); // too short
  assert.equal(parseModeratorInput({ phone: '' }), null);
  assert.equal(parseModeratorInput({ phone: 'invalid text' }), null);
  assert.equal(parseModeratorInput(null), null);
});
