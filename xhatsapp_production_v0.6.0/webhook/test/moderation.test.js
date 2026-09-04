import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildModerationAlert,
  createAlertCode,
  detectModeration,
  parseModerationCommand,
} from '../src/moderation.js';

test('detects an agency promotion in French', () => {
  const result = detectModeration('Notre agence propose une offre Hajj à 490 EUR');
  assert.equal(result.flagged, true);
  assert.deepEqual(result.categories, ['agency', 'advertising']);
});

test('detects a donation request', () => {
  const result = detectModeration('Participez à cette cagnotte de donation');
  assert.equal(result.flagged, true);
  assert.ok(result.categories.includes('donation'));
});

test('detects the Arabic hotel price example', () => {
  const result = detectModeration('متوفر فندق قريب بسعر 500 ريال');
  assert.equal(result.flagged, true);
  assert.ok(result.categories.includes('advertising'));
});

test('does not flag an ordinary support question', () => {
  assert.equal(detectModeration('Comment ajouter mon épouse au groupe familial ?').flagged, false);
});

test('parses strict admin decisions only', () => {
  assert.deepEqual(parseModerationCommand(' supprimer ab12cd '), {
    action: 'delete',
    code: 'AB12CD',
  });
  assert.deepEqual(parseModerationCommand('IGNORER ZX89Q2'), {
    action: 'ignore',
    code: 'ZX89Q2',
  });
  assert.equal(parseModerationCommand('supprime tout'), null);
});

test('creates opaque six-character codes', () => {
  assert.match(createAlertCode(), /^[A-Z0-9]{6}$/);
});

test('builds an admin alert without raw WhatsApp identifiers', () => {
  const alert = buildModerationAlert({
    code: 'AB12CD',
    categories: ['agency'],
    groupName: 'Groupe_01',
    groupReference: '0c5a45d0f8a4',
    senderName: 'Membre',
    text: 'Offre de test',
  });
  assert.match(alert, /SUPPRIMER AB12CD/);
  assert.match(alert, /0c5a45d0f8a4/);
  assert.doesNotMatch(alert, /@g\.us|@c\.us|@lid/);
});
