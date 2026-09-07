import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditDuplicates,
  buildDuplicateAdminAlert,
  buildDuplicateAuditReport,
  buildDuplicateRefusalDm,
  buildFlashMessage,
  buildLockNotice,
  buildOnboardingDm,
  buildPanicAlert,
  buildUnlockNotice,
  detectPanic,
  parseCommunityCommand,
} from '../src/community.js';

test('parses community admin commands with case-insensitivity', () => {
  assert.deepEqual(parseCommunityCommand('BLOCK ALL'), { type: 'block_all' });
  assert.deepEqual(parseCommunityCommand('block all'), { type: 'block_all' });
  assert.deepEqual(parseCommunityCommand('blok all'), { type: 'block_all' });
  assert.deepEqual(parseCommunityCommand('VERROUILLER TOUT'), { type: 'block_all' });

  assert.deepEqual(parseCommunityCommand('UNBLOCK ALL'), { type: 'unblock_all' });
  assert.deepEqual(parseCommunityCommand('unblock all'), { type: 'unblock_all' });
  assert.deepEqual(parseCommunityCommand('unblok all'), { type: 'unblock_all' });
  assert.deepEqual(parseCommunityCommand('DEVERROUILLER TOUT'), { type: 'unblock_all' });

  assert.deepEqual(parseCommunityCommand('DOUBLONS'), { type: 'audit_doublons' });
  assert.deepEqual(parseCommunityCommand('audit doublons'), { type: 'audit_doublons' });
  assert.deepEqual(parseCommunityCommand('doublon'), { type: 'audit_doublons' });

  assert.deepEqual(
    parseCommunityCommand('FLASH Vol Médine retardé de 3 heures'),
    { type: 'flash', message: 'Vol Médine retardé de 3 heures' },
  );
  assert.deepEqual(
    parseCommunityCommand('flash:\nAttention aux faux guides'),
    { type: 'flash', message: 'Attention aux faux guides' },
  );
  assert.deepEqual(
    parseCommunityCommand('FLASH   '),
    { type: 'flash', error: 'flash_empty' },
  );

  assert.equal(parseCommunityCommand('Bonjour à tous'), null);
  assert.equal(parseCommunityCommand(''), null);
  assert.equal(parseCommunityCommand(null), null);
});

test('detects panic and rumor keywords without false positives on normal questions', () => {
  const panic1 = detectPanic('Attention c’est une arnaque, mon compte a été piraté !');
  assert.equal(panic1.isPanic, true);
  assert.ok(panic1.matches.includes('arnaque'));
  assert.ok(panic1.matches.includes('piratage'));

  const panic2 = detectPanic('Des personnes sont bloquées à l’aéroport à cause de faux billets !');
  assert.equal(panic2.isPanic, true);
  assert.ok(panic2.matches.includes('bloqué'));
  assert.ok(panic2.matches.includes('faux billet / visa'));

  const panic3 = detectPanic('On va aller voir la police pour déposer plainte, c’est un scandale');
  assert.equal(panic3.isPanic, true);
  assert.ok(panic3.matches.includes('plainte / police'));
  assert.ok(panic3.matches.includes('scandale'));

  const normal = detectPanic('Quel est le prix du billet de train pour aller à Médine ?');
  assert.equal(normal.isPanic, false);
  assert.equal(normal.matches.length, 0);

  const normal2 = detectPanic('Est-ce que l’application Nusuk est disponible en français ?');
  assert.equal(normal2.isPanic, false);
});

test('builds panic alert, flash message, and notices correctly', () => {
  const alert = buildPanicAlert({
    groupName: 'Groupe_01',
    groupReference: 'grp-01',
    senderName: 'Karim',
    senderReference: 'usr-123',
    text: 'C’est une grosse arnaque !',
    matches: ['arnaque'],
  });
  assert.ok(alert.includes('SENTINELLE : ALERTE PANIQUE'));
  assert.ok(alert.includes('Groupe_01'));
  assert.ok(alert.includes('Karim'));
  assert.ok(alert.includes('arnaque'));

  const flash = buildFlashMessage('Information officielle sur les transferts.');
  assert.ok(flash.includes('FLASH INFO OFFICIEL NUSUK'));
  assert.ok(flash.includes('Information officielle sur les transferts.'));

  const lock = buildLockNotice();
  assert.ok(lock.includes('GROUPE TEMPORAIREMENT VERROUILLÉ'));

  const unlock = buildUnlockNotice();
  assert.ok(unlock.includes('DISCUSSIONS RÉOUVERTES'));
});

test('builds onboarding and duplicate refusal DMs', () => {
  const onboarding = buildOnboardingDm();
  assert.ok(onboarding.includes('Nusuk Hajj 1447 / 2026'));
  assert.ok(onboarding.includes('Neutralité absolue'));
  assert.ok(onboarding.includes('un seul groupe'));

  const refusal = buildDuplicateRefusalDm('Groupe_02', 'Groupe_01');
  assert.ok(refusal.includes('Groupe_02'));
  assert.ok(refusal.includes('Groupe_01'));
  assert.ok(refusal.includes('automatiquement refusée'));

  const customOnboarding = buildOnboardingDm('Bienvenue personnalisé !');
  assert.equal(customOnboarding, 'Bienvenue personnalisé !');

  const customRefusal = buildDuplicateRefusalDm('G2', 'G1', 'Refus de {newGroupName} car déjà dans {existingGroupName}');
  assert.equal(customRefusal, 'Refus de G2 car déjà dans G1');

  const adminAlert = buildDuplicateAdminAlert({
    senderPhone: '33612345678',
    senderReference: 'usr-999',
    newGroupName: 'Groupe_02',
    existingGroupName: 'Groupe_01',
    isRequest: true,
  });
  assert.ok(adminAlert.includes('DOUBLON REFUSÉ'));
  assert.ok(adminAlert.includes('+33612345678'));
  assert.ok(adminAlert.includes('Groupe_02'));
  assert.ok(adminAlert.includes('Groupe_01'));
  assert.ok(adminAlert.includes('Demande d’adhésion automatiquement rejetée'));
});

test('audits duplicates across groups while strictly excluding admins', () => {
  const mockGroups = [
    {
      id: 'g1@g.us',
      name: 'Groupe_01',
      participants: [
        { id: 'admin1@c.us', number: '33600000001', isAdmin: true, isSuperAdmin: true },
        { id: 'user1@c.us', number: '33611111111', isAdmin: false, isSuperAdmin: false },
        { id: 'user2@c.us', number: '33622222222', isAdmin: false, isSuperAdmin: false },
      ],
    },
    {
      id: 'g2@g.us',
      name: 'Groupe_02',
      participants: [
        { id: 'admin1@c.us', number: '33600000001', isAdmin: false, isSuperAdmin: false }, // admin in g1!
        { id: 'user1@c.us', number: '33611111111', isAdmin: false, isSuperAdmin: false }, // DUPLICATE !
        { id: 'user3@c.us', number: '33633333333', isAdmin: false, isSuperAdmin: false },
      ],
    },
    {
      id: 'g3@g.us',
      name: 'Groupe_03',
      participants: [
        { id: 'user1@c.us', number: '33611111111', isAdmin: false, isSuperAdmin: false }, // In 3 groups !
        { id: 'user4@c.us', number: '33644444444', isAdmin: false, isSuperAdmin: false },
      ],
    },
  ];

  const audit = auditDuplicates(mockGroups);
  assert.equal(audit.groupsCount, 3);
  // admin1 should be excluded from duplicates even if not marked admin in g2
  assert.equal(audit.duplicatesCount, 1);
  assert.equal(audit.duplicates[0].phone, '33611111111');
  assert.deepEqual(audit.duplicates[0].groups, ['Groupe_01', 'Groupe_02', 'Groupe_03']);

  const report = buildDuplicateAuditReport(audit);
  assert.ok(report.includes('AUDIT DES MEMBRES EN DOUBLON'));
  assert.ok(report.includes('+33611111111'));
  assert.ok(report.includes('présent dans 3 groupes'));

  const emptyAudit = auditDuplicates([
    {
      id: 'g1@g.us',
      name: 'Groupe_01',
      participants: [
        { id: 'u1@c.us', number: '33611111111', isAdmin: false, isSuperAdmin: false },
      ],
    },
    {
      id: 'g2@g.us',
      name: 'Groupe_02',
      participants: [
        { id: 'u2@c.us', number: '33622222222', isAdmin: false, isSuperAdmin: false },
      ],
    },
  ]);
  assert.equal(emptyAudit.duplicatesCount, 0);
  const cleanReport = buildDuplicateAuditReport(emptyAudit);
  assert.ok(cleanReport.includes('Aucun membre en doublon'));
});

test('normalizes phone numbers and checks exempt moderator status', async () => {
  const { normalizePhoneNumber, isPhoneExempt, buildModeratorsListMessage } = await import('../src/community.js');

  assert.equal(normalizePhoneNumber('06 12 34 56 78'), '33612345678');
  assert.equal(normalizePhoneNumber('+33 6 12 34 56 78'), '33612345678');
  assert.equal(normalizePhoneNumber('07 88 99 00 11'), '33788990011');
  assert.equal(normalizePhoneNumber('966501234567'), '966501234567');

  const exemptList = [
    { phone: '06 12 34 56 78', normalized_phone: '33612345678', label: 'Modérateur Yahia' },
    { phone: '+966 50 123 4567', normalized_phone: '966501234567', label: 'Guide Médine' },
  ];

  assert.equal(isPhoneExempt('33612345678@c.us', exemptList), true);
  assert.equal(isPhoneExempt('0612345678', exemptList), true);
  assert.equal(isPhoneExempt('+33612345678', exemptList), true);
  assert.equal(isPhoneExempt('966501234567@c.us', exemptList), true);
  assert.equal(isPhoneExempt('33699999999@c.us', exemptList), false);
  assert.equal(isPhoneExempt(null, exemptList), false);
  assert.equal(isPhoneExempt('33612345678', []), false);

  // Check auditDuplicates ignores exempt moderators even if present in multiple groups
  const mockGroups = [
    {
      id: 'g1@g.us',
      name: 'Groupe_01',
      participants: [
        { id: '33612345678@c.us', number: '33612345678', isAdmin: false, isSuperAdmin: false },
        { id: 'user_dup@c.us', number: '33688888888', isAdmin: false, isSuperAdmin: false },
      ],
    },
    {
      id: 'g2@g.us',
      name: 'Groupe_02',
      participants: [
        { id: '33612345678@c.us', number: '33612345678', isAdmin: false, isSuperAdmin: false },
        { id: 'user_dup@c.us', number: '33688888888', isAdmin: false, isSuperAdmin: false },
      ],
    },
  ];

  const audit = auditDuplicates(mockGroups, exemptList);
  assert.equal(audit.duplicatesCount, 1);
  assert.equal(audit.duplicates[0].phone, '33688888888');

  // Check message formatting
  const msgEmpty = buildModeratorsListMessage([]);
  assert.ok(msgEmpty.includes('Aucun modérateur n’est enregistré'));

  const msgList = buildModeratorsListMessage(exemptList);
  assert.ok(msgList.includes('Total enregistrés : 2'));
  assert.ok(msgList.includes('Modérateur Yahia'));
  assert.ok(msgList.includes('06 12 34 56 78'));
});
