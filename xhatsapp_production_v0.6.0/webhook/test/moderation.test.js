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

test('detects donation platforms and humanitarian appeals without auto-deletion', () => {
  const leetchi = detectModeration('Aidez-nous sur cette cagnotte https://www.leetchi.com/c/hajj-solidaire');
  assert.equal(leetchi.flagged, true);
  assert.ok(leetchi.categories.includes('donation'));
  assert.equal(leetchi.isForbiddenAgency, false);

  const cotizup = detectModeration('Faites un geste sur cotizup.com/soutien');
  assert.equal(cotizup.flagged, true);
  assert.ok(cotizup.categories.includes('donation'));
  assert.equal(cotizup.isForbiddenAgency, false);

  const somalie = detectModeration('Urgence pour aider les pauvres en Somalie qui meurent de faim');
  assert.equal(somalie.flagged, true);
  assert.ok(somalie.categories.includes('donation'));
  assert.equal(somalie.isForbiddenAgency, false);

  const puits = detectModeration('Appel pour financer un puits en Afrique pour une sadaqa jariya');
  assert.equal(puits.flagged, true);
  assert.ok(puits.categories.includes('donation'));
  assert.equal(puits.isForbiddenAgency, false);

  const rib = detectModeration('Envoyez vos dons sur le RIB FR7630001007941234567890185');
  assert.equal(rib.flagged, true);
  assert.ok(rib.categories.includes('donation'));
  assert.equal(rib.isForbiddenAgency, false);
});

test('detects forbidden agencies from dictionary with auto-deletion flag', () => {
  const acmuv = detectModeration('Quelqu un a des avis sur ACMUV ?');
  assert.equal(acmuv.flagged, true);
  assert.equal(acmuv.isForbiddenAgency, true);
  assert.equal(acmuv.matchedAgency, 'ACMUV');

  const bouraq = detectModeration('Nous avons choisi Al Bouraq pour notre voyage');
  assert.equal(bouraq.flagged, true);
  assert.equal(bouraq.isForbiddenAgency, true);

  const bookingMakkah = detectModeration('Regardez les forfaits de Booking Makkah');
  assert.equal(bookingMakkah.flagged, true);
  assert.equal(bookingMakkah.isForbiddenAgency, true);

  // Dynamic custom agency from DB cache
  const custom = detectModeration('Voici une agence nouvelle Agence Inconnue 2026', ['Agence Inconnue 2026']);
  assert.equal(custom.flagged, true);
  assert.equal(custom.isForbiddenAgency, true);
  assert.equal(custom.matchedAgency, 'Agence Inconnue 2026');
});

test('respects exceptions for Saudi platforms and community terms', () => {
  assert.equal(detectModeration('J ai pris mon pack directement sur Nusuk').flagged, false);
  assert.equal(detectModeration('Bienvenue sur le groupe Entraide Nusuk Hajj').flagged, false);
  assert.equal(detectModeration('Est-ce possible de partir sans agence cette annee ?').flagged, false);
  assert.equal(detectModeration('Ithraa Al Khair est le provider saoudien officiel').flagged, false);
  assert.equal(detectModeration('J arrive dans 10 mn inchaAllah').flagged, false);

  // But France Nusuk must be flagged
  const franceNusuk = detectModeration('Je suis passe par France Nusuk pour mon depart');
  assert.equal(franceNusuk.flagged, true);
  assert.equal(franceNusuk.isForbiddenAgency, true);
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

test('builds an admin alert without raw WhatsApp identifiers for manual moderation', () => {
  const alert = buildModerationAlert({
    code: 'AB12CD',
    categories: ['donation'],
    groupName: 'Groupe_01',
    groupReference: '0c5a45d0f8a4',
    senderName: 'Membre',
    text: 'Cagnotte solidaire Leetchi',
    autoDeleted: false,
  });
  assert.match(alert, /SUPPRIMER AB12CD/);
  assert.match(alert, /IGNORER AB12CD/);
  assert.match(alert, /0c5a45d0f8a4/);
  assert.doesNotMatch(alert, /@g\.us|@c\.us|@lid/);
  assert.doesNotMatch(alert, /AUTOMATIQUEMENT SUPPRIMÉ/);
});

test('builds an admin alert for auto-deleted agency citation', () => {
  const alert = buildModerationAlert({
    code: 'AG77XX',
    categories: ['agency_citation'],
    groupName: 'Groupe_02',
    groupReference: '0c5a45d0f8a4',
    senderName: 'Membre',
    text: 'Avis sur ACMUV ?',
    autoDeleted: true,
  });
  assert.match(alert, /Modération automatique Xhatsapp/);
  assert.match(alert, /supprimé automatiquement/i);
  assert.match(alert, /rappel de neutralité/i);
  assert.doesNotMatch(alert, /SUPPRIMER AG77XX/);
  assert.doesNotMatch(alert, /IGNORER AG77XX/);
  assert.doesNotMatch(alert, /@g\.us|@c\.us|@lid/);
});
