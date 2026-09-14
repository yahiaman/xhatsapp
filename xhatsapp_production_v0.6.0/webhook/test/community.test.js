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

test('parses STATUT, BAN, UNBAN, and Resource commands', async () => {
  const { parseCommunityCommand, isPhoneBanned } = await import('../src/community.js');

  // Status commands
  assert.deepEqual(parseCommunityCommand('STATUT'), { type: 'status' });
  assert.deepEqual(parseCommunityCommand('statut'), { type: 'status' });
  assert.deepEqual(parseCommunityCommand('SANTE'), { type: 'status' });
  assert.deepEqual(parseCommunityCommand('STATUS'), { type: 'status' });
  assert.deepEqual(parseCommunityCommand('ETAT'), { type: 'status' });

  // Ban commands
  assert.deepEqual(
    parseCommunityCommand('BAN +33612345678 Publicité frauduleuse'),
    { type: 'ban', phone: '+33612345678', reason: 'Publicité frauduleuse' },
  );
  assert.deepEqual(
    parseCommunityCommand('ban 06 12 34 56 78'),
    { type: 'ban', phone: '06 12 34 56 78', reason: null },
  );
  assert.deepEqual(
    parseCommunityCommand('BLACKLIST 33700000000 Arnaque'),
    { type: 'ban', phone: '33700000000', reason: 'Arnaque' },
  );

  // Unban commands
  assert.deepEqual(
    parseCommunityCommand('UNBAN +33612345678'),
    { type: 'unban', phone: '+33612345678' },
  );
  assert.deepEqual(
    parseCommunityCommand('deban 0612345678'),
    { type: 'unban', phone: '0612345678' },
  );

  // List bans
  assert.deepEqual(parseCommunityCommand('LISTE BAN'), { type: 'list_bans' });
  assert.deepEqual(parseCommunityCommand('liste bans'), { type: 'list_bans' });
  assert.deepEqual(parseCommunityCommand('BANS'), { type: 'list_bans' });
  assert.deepEqual(parseCommunityCommand('BLACKLIST'), { type: 'list_bans' });
  assert.deepEqual(parseCommunityCommand('LISTE NOIRE'), { type: 'list_bans' });

  // Resource list & shortcuts
  assert.deepEqual(parseCommunityCommand('RESSOURCES'), { type: 'list_resources' });
  assert.deepEqual(parseCommunityCommand('liste ressources'), { type: 'list_resources' });
  assert.deepEqual(parseCommunityCommand('LIENS'), { type: 'list_resources' });
  assert.deepEqual(parseCommunityCommand('!youtube'), { type: 'shortcut', shortcut: 'youtube' });
  assert.deepEqual(parseCommunityCommand('!site'), { type: 'shortcut', shortcut: 'site' });
  assert.deepEqual(parseCommunityCommand('!hotels'), { type: 'shortcut', shortcut: 'hotels' });

  // isPhoneBanned check
  const banned = [
    { phone: '+33 6 99 99 99 99', normalized_phone: '33699999999', reason: 'Spam' },
  ];
  assert.equal(isPhoneBanned('33699999999@c.us', banned), true);
  assert.equal(isPhoneBanned('0699999999', banned), true);
  assert.equal(isPhoneBanned('+33699999999', banned), true);
  assert.equal(isPhoneBanned('0612345678', banned), false);
  assert.equal(isPhoneBanned(null, banned), false);
});

test('detects resource mentions and builds cards properly', async () => {
  const {
    detectResourceMention,
    buildResourceMessage,
    buildAllResourcesMessage,
    buildStatusReport,
    buildBanSuccessMessage,
    buildBannedListMessage,
    buildBannedAttemptAlert,
  } = await import('../src/community.js');

  const mockResources = [
    {
      id: 'youtube',
      title: 'Chaîne YouTube Entraide Nusuk Hajj',
      url: 'https://www.youtube.com/@entraidenusukhajj',
      description: 'Nos guides vidéos pour préparer le Hajj.',
      keywords: ['youtube', 'chaine youtube', 'video', 'videos', 'tuto', 'tutoriel'],
    },
    {
      id: 'site',
      title: 'Site Web Officiel',
      url: 'https://entraide-nusuk-hajj.com',
      description: 'Articles et démarches.',
      keywords: ['site', 'site internet', 'site web', 'notre site', 'article'],
    },
    {
      id: 'hotels',
      title: 'Cartes des Hôtels',
      url: 'https://entraide-nusuk-hajj.com/hotels',
      description: 'Localisation et distances des hôtels.',
      keywords: ['hotel', 'hotels', 'carte', 'cartes des hotels', 'distance'],
    },
  ];

  // 1. Direct shortcuts
  const matchShortcut = detectResourceMention('!youtube', mockResources);
  assert.ok(matchShortcut);
  assert.equal(matchShortcut.type, 'resource');
  assert.equal(matchShortcut.resource.id, 'youtube');

  const matchAll = detectResourceMention('!liens', mockResources);
  assert.ok(matchAll);
  assert.equal(matchAll.type, 'all');

  // 2. Natural language mentions
  const matchNatural1 = detectResourceMention('N’hésitez pas à consulter notre chaîne youtube pour voir le tuto.', mockResources);
  assert.ok(matchNatural1);
  assert.equal(matchNatural1.resource.id, 'youtube');

  const matchNatural2 = detectResourceMention('Toutes les infos sont disponibles sur notre site internet !', mockResources);
  assert.ok(matchNatural2);
  assert.equal(matchNatural2.resource.id, 'site');

  const matchNatural3 = detectResourceMention('Avez-vous vu la carte des hotels à Médine ?', mockResources);
  assert.ok(matchNatural3);
  assert.equal(matchNatural3.resource.id, 'hotels');

  // Negative test: irrelevant sentence
  const noMatch = detectResourceMention('Bonjour frère quel est le tarif du mouton ?', mockResources);
  assert.equal(noMatch, null);

  // 3. Builders tests
  const resourceCard = buildResourceMessage(mockResources[0]);
  assert.ok(resourceCard.includes('CHAÎNE YOUTUBE'));
  assert.ok(resourceCard.includes('https://www.youtube.com/@entraidenusukhajj'));

  const allCard = buildAllResourcesMessage(mockResources);
  assert.ok(allCard.includes('RESSOURCES & LIENS OFFICIELS'));
  assert.ok(allCard.includes('Chaîne YouTube'));
  assert.ok(allCard.includes('Site Web Officiel'));

  const statusReport = buildStatusReport({
    sessionConnected: true,
    sessionDetails: '+33611457462',
    monitoredGroups: [
      { name: 'Groupe_01', participantCount: 850, isAnnounce: false },
      { name: 'Groupe_02', participantCount: 420, isAnnounce: true },
    ],
    antiBanEnabled: true,
    scheduleTimes: { lock: '23h00', unlock: '07h00', recap: '20h10' },
    moderatorsCount: 3,
    bannedCount: 1,
  });
  assert.ok(statusReport.includes('ÉTAT DU SYSTÈME XHATSAPP'));
  assert.ok(statusReport.includes('🟢 Connecté (+33611457462)'));
  assert.ok(statusReport.includes('*Groupe_01* : 850 membres (🔓 Ouvert)'));
  assert.ok(statusReport.includes('*Groupe_02* : 420 membres (🔒 Verrouillé)'));
  assert.ok(statusReport.includes('*Total pèlerins :* ~1270 membres'));
  assert.ok(statusReport.includes('Membres bannis (Liste noire) : 1'));

  const banMsg = buildBanSuccessMessage({
    phone: '33612345678',
    reason: 'Spam de masse',
    kickedGroups: ['Groupe_01'],
  });
  assert.ok(banMsg.includes('MEMBRE BANNI AVEC SUCCÈS'));
  assert.ok(banMsg.includes('+33612345678'));
  assert.ok(banMsg.includes('Spam de masse'));
  assert.ok(banMsg.includes('Groupe_01'));

  const banListMsg = buildBannedListMessage([
    { normalized_phone: '33612345678', reason: 'Arnaque' },
  ]);
  assert.ok(banListMsg.includes('LISTE NOIRE DES MEMBRES BANNIS'));
  assert.ok(banListMsg.includes('+33612345678 (Arnaque)'));

  const bannedAlert = buildBannedAttemptAlert({
    phone: '33612345678',
    senderReference: 'usr_ban',
    groupName: 'Groupe_02',
    isRequest: true,
  });
  assert.ok(bannedAlert.includes('ALERTE : TENTATIVE D’ACCÈS PAR UN MEMBRE BANNI'));
  assert.ok(bannedAlert.includes('Demande d’adhésion automatiquement rejetée'));
});

