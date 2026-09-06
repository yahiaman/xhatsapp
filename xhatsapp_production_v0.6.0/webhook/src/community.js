/**
 * Module de gestion avancée de la communauté (Community Management)
 * Entraide Nusuk Hajj 1447 / 2026
 */

export function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘ʻ]/g, "'")
    .toLowerCase();
}

export const PANIC_PATTERNS = [
  { term: 'arnaque', regex: /\barnaqu(?:e|es|er|eurs?)\b/i },
  { term: 'escroquerie', regex: /\b(?:escroc|escrocs|escroquerie|escroqueries)\b/i },
  { term: 'scandale', regex: /\bscandales?\b/i },
  { term: 'faux billet / visa', regex: /\bfaux\s+(?:billets?|visas?|reservations?)\b/i },
  { term: 'piratage', regex: /\b(?:piratage|piratages|pirate|piratee|pirater|pirates)\b|\bcompte\s+pirate\b/i },
  { term: 'plainte / police', regex: /\b(?:deposer|porter)\s+plainte\b|\bplaintes?\b|\bpolice\b|\bgendarmerie\b/i },
  { term: 'bloqué', regex: /\bbloqu(?:e|es|ee|ees)\s+(?:a\s+l'aeroport|a\s+jeddah|a\s+medine|a\s+la\s+douane)\b/i },
  { term: 'vols annulés', regex: /\bvols?\s+annul(?:e|es|ee|ees)\b|\bannulations?\s+massives?\b/i },
  { term: 'fraude', regex: /\bfraudes?\b|\bfrauduleux\b/i },
  { term: 'vol d’argent', regex: /\bvol\s+d['’]argent\b|\bon\s+m['’]a\s+vole\b/i },
];

export function parseCommunityCommand(rawText) {
  if (typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toUpperCase();

  if (normalized === 'BLOCK ALL' || normalized === 'BLOK ALL' || normalized === 'VERROUILLER TOUT' || normalized === 'VERROUILLER TOUS') {
    return { type: 'block_all' };
  }

  if (normalized === 'UNBLOCK ALL' || normalized === 'UNBLOK ALL' || normalized === 'DEVERROUILLER TOUT' || normalized === 'DEVERROUILLER TOUS') {
    return { type: 'unblock_all' };
  }

  if (normalized === 'DOUBLONS' || normalized === 'AUDIT DOUBLONS' || normalized === 'DOUBLON') {
    return { type: 'audit_doublons' };
  }

  if (/^FLASH(?:\s+|:|$)/i.test(trimmed)) {
    const flashBody = trimmed.replace(/^FLASH(?:\s*:|\s+)?/i, '').trim();
    if (!flashBody) {
      return { type: 'flash', error: 'flash_empty' };
    }
    return { type: 'flash', message: flashBody };
  }

  return null;
}

export function detectPanic(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { isPanic: false, matches: [] };
  }
  const clean = normalizeText(text);
  const matches = [];
  for (const item of PANIC_PATTERNS) {
    if (item.regex.test(clean)) {
      matches.push(item.term);
    }
  }
  return {
    isPanic: matches.length > 0,
    matches,
  };
}

export function buildPanicAlert({
  groupName,
  groupReference,
  senderName,
  senderReference,
  text,
  matches,
}) {
  const authorLabel = senderName ? `${senderName} (${senderReference})` : senderReference;
  const groupLabel = groupName ? `${groupName} (${groupReference})` : groupReference;
  return [
    '🚨 *SENTINELLE : ALERTE PANIQUE / RUMEUR* 🚨',
    `📍 *Groupe :* ${groupLabel}`,
    `👤 *Auteur :* ${authorLabel}`,
    `⚠️ *Termes détectés :* ${matches.join(', ')}`,
    '',
    '💬 *Message :*',
    `"${text}"`,
    '',
    'ℹ️ _Message non supprimé. Clarification officielle ou intervention recommandée dans le groupe si la rumeur se propage._',
  ].join('\n');
}

export function buildFlashMessage(message) {
  return [
    '🚨 *FLASH INFO OFFICIEL NUSUK* 🚨',
    '───────────────────────────',
    message,
    '───────────────────────────',
    'ℹ️ _Message officiel de l’équipe d’administration._',
  ].join('\n');
}

export function buildLockNotice() {
  return [
    '🔒 *GROUPE TEMPORAIREMENT VERROUILLÉ*',
    '',
    'Les discussions sont temporairement suspendues par l’équipe d’administration.',
    'Seuls les administrateurs peuvent publier le temps de diffuser une information ou de modérer les échanges.',
  ].join('\n');
}

export function buildUnlockNotice() {
  return [
    '🔓 *DISCUSSIONS RÉOUVERTES*',
    '',
    'Les discussions sont de nouveau ouvertes à tous.',
    'Merci à chacune et chacun de veiller au respect de la bienveillance, de la fraternité et de la neutralité.',
  ].join('\n');
}

export function buildOnboardingDm() {
  return [
    'Assalamu alaykum wa rahmatullah chère sœur / cher frère,',
    '',
    'Bienvenue dans la communauté d’entraide *Nusuk Hajj 1447 / 2026* 🕋 !',
    '',
    'Afin de préserver la sérénité et l’utilité de nos échanges, voici les *règles d’or* à respecter :',
    '1️⃣ *Neutralité absolue* : Aucune citation, recommandation ou critique d’agence de voyage n’est autorisée.',
    '2️⃣ *Aucune publicité ni collecte* : Pas de vente de services, pas de liens de cagnottes, de dons ou de parrainage.',
    '3️⃣ *Fraternité & Sérénité* : Respect strict entre pèlerins, aucune polémique ni propagation de rumeurs non vérifiées.',
    '4️⃣ *Fermeture nocturne* : Les échanges sont automatiquement mis en pause chaque soir de 23h00 à 07h00.',
    '5️⃣ *Récapitulatif quotidien* : Chaque soir à 20h10, un résumé complet des informations clés vous est partagé.',
    '',
    '📌 *Rappel important* : Tous nos groupes partagent strictement les mêmes informations. Votre présence dans *un seul groupe* est largement suffisante et permet de laisser la place à d’autres pèlerins.',
    '',
    'Qu’Allah facilite vos démarches et accepte votre pèlerinage ! 🤲',
  ].join('\n');
}

export function buildDuplicateRefusalDm(newGroupName, existingGroupName) {
  return [
    'Assalamu alaykum wa rahmatullah chère sœur / cher frère,',
    '',
    `Vous venez de tenter de rejoindre le groupe *${newGroupName}*, mais notre système a constaté que vous êtes déjà membre du groupe *${existingGroupName}*.`,
    '',
    'Afin de permettre au plus grand nombre de futurs pèlerins d’accéder aux échanges (les places étant limitées par WhatsApp) :',
    '👉 *Votre adhésion à ce second groupe a été automatiquement refusée.*',
    '',
    '💡 *Rassurez-vous :* Tous nos groupes bénéficient rigoureusement des mêmes annonces, des mêmes alertes officielles et du même récapitulatif quotidien de 20h10. Vous ne manquez absolument rien en restant dans votre groupe actuel.',
    '',
    'Merci pour votre fraternité, votre compréhension et votre solidarité entre pèlerins. 🤝',
    'Qu’Allah bénisse et facilite votre Hajj ! 🤲',
  ].join('\n');
}

export function buildDuplicateAdminAlert({
  senderPhone,
  senderReference,
  newGroupName,
  existingGroupName,
}) {
  const member = senderPhone ? `+${senderPhone} (${senderReference})` : senderReference;
  return [
    '🛡️ *PROTECTION MULTI-GROUPES (DOUBLON REFUSÉ)*',
    `👤 *Membre :* ${member}`,
    `🚫 *Groupe tenté :* ${newGroupName}`,
    `✅ *Déjà présent dans :* ${existingGroupName}`,
    '⚙️ *Action :* Membre automatiquement exclu du second groupe + MP explicatif envoyé.',
  ].join('\n');
}

export function formatParticipantPhone(participant) {
  if (participant.number) {
    return participant.number.replace(/\D/g, '');
  }
  if (participant.id) {
    const raw = participant.id.split('@')[0];
    return raw.replace(/\D/g, '');
  }
  return '';
}

export function auditDuplicates(groupsData) {
  const adminNumbers = new Set();
  const allPilgrims = new Map();

  // Step 1: identify all admins across all groups
  for (const group of groupsData) {
    for (const p of group.participants || []) {
      const phone = formatParticipantPhone(p);
      const key = phone || p.id;
      if (p.isAdmin || p.isSuperAdmin) {
        if (key) adminNumbers.add(key);
        if (phone) adminNumbers.add(phone);
        if (p.id) adminNumbers.add(p.id);
      }
    }
  }

  // Step 2: map regular participants
  let totalPresences = 0;
  for (const group of groupsData) {
    for (const p of group.participants || []) {
      const phone = formatParticipantPhone(p);
      const key = phone || p.id;
      if (!key) continue;

      totalPresences += 1;
      // Skip admins/moderators
      if (adminNumbers.has(key) || adminNumbers.has(phone) || adminNumbers.has(p.id)) {
        continue;
      }

      const existing = allPilgrims.get(key) || {
        id: p.id,
        phone,
        name: p.name || null,
        groups: new Set(),
      };
      existing.groups.add(group.name || group.id);
      allPilgrims.set(key, existing);
    }
  }

  const duplicates = [];
  for (const [, item] of allPilgrims) {
    if (item.groups.size > 1) {
      duplicates.push({
        id: item.id,
        phone: item.phone,
        name: item.name,
        groups: Array.from(item.groups),
      });
    }
  }

  return {
    groupsCount: groupsData.length,
    totalPresences,
    regularPilgrimsCount: allPilgrims.size,
    duplicatesCount: duplicates.length,
    duplicates,
  };
}

export function buildDuplicateAuditReport(audit) {
  if (audit.duplicatesCount === 0) {
    return [
      '✅ *AUDIT DES DOUBLONS*',
      '───────────────────────────',
      `🔍 Groupes analysés : ${audit.groupsCount}`,
      `👥 Pèlerins distincts répertoriés : ${audit.regularPilgrimsCount}`,
      '',
      '🎉 Aucun membre en doublon détecté parmi les groupes surveillés (administrateurs exclus).',
    ].join('\n');
  }

  const lines = [
    '📊 *AUDIT DES MEMBRES EN DOUBLON* 📊',
    '───────────────────────────',
    `🔍 Groupes analysés : ${audit.groupsCount}`,
    `👥 Pèlerins distincts : ${audit.regularPilgrimsCount}`,
    `⚠️ *Membres en doublon : ${audit.duplicatesCount}* (hors administrateurs)`,
    '',
    '*Liste des doublons détectés :*',
  ];

  audit.duplicates.forEach((item, index) => {
    const phoneDisplay = item.phone ? `+${item.phone}` : item.id;
    const nameDisplay = item.name ? ` (${item.name})` : '';
    lines.push(`${index + 1}. ${phoneDisplay}${nameDisplay} : présent dans ${item.groups.length} groupes [${item.groups.join(', ')}]`);
  });

  lines.push('');
  lines.push('ℹ️ _Ces membres peuvent être retirés manuellement d’un de leurs groupes si nécessaire pour libérer des places._');

  return lines.join('\n');
}
