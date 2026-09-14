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

  if (normalized === 'MODERATEURS' || normalized === 'MODERATEUR' || normalized === 'LISTE MODERATEURS' || normalized === 'WHITELIST') {
    return { type: 'list_moderators' };
  }

  if (
    normalized === 'STATUT' ||
    normalized === 'SANTE' ||
    normalized === 'STATUS' ||
    normalized === 'HEALTH' ||
    normalized === 'ETAT' ||
    normalized === 'INFOS'
  ) {
    return { type: 'status' };
  }

  if (
    normalized === 'LISTE BAN' ||
    normalized === 'LISTE BANS' ||
    normalized === 'BANS' ||
    normalized === 'BLACKLIST' ||
    normalized === 'LISTE NOIRE'
  ) {
    return { type: 'list_bans' };
  }

  if (
    normalized === 'RESSOURCES' ||
    normalized === 'LISTE RESSOURCES' ||
    normalized === 'LIENS' ||
    normalized === 'LISTE LIENS'
  ) {
    return { type: 'list_resources' };
  }

  const banMatch = trimmed.match(/^(?:BAN|BLACKLIST|EXPULSER)\s+([+\d\s\-_().]{6,30})(?:\s+(.+))?$/i);
  if (banMatch) {
    return {
      type: 'ban',
      phone: banMatch[1].trim(),
      reason: banMatch[2] ? banMatch[2].trim() : null,
    };
  }

  const unbanMatch = trimmed.match(/^(?:UNBAN|DEBAN|DEBLOQUER)\s+([+\d\s\-_().]{6,30})$/i);
  if (unbanMatch) {
    return {
      type: 'unban',
      phone: unbanMatch[1].trim(),
    };
  }

  if (/^FLASH(?:\s+|:|$)/i.test(trimmed)) {
    const flashBody = trimmed.replace(/^FLASH(?:\s*:|\s+)?/i, '').trim();
    if (!flashBody) {
      return { type: 'flash', error: 'flash_empty' };
    }
    return { type: 'flash', message: flashBody };
  }

  const shortcutMatch = trimmed.match(/^!([a-zA-Z0-9_\-]+)$/);
  if (shortcutMatch) {
    return {
      type: 'shortcut',
      shortcut: shortcutMatch[1].toLowerCase(),
    };
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

export function buildOnboardingDm(customTemplate = null) {
  if (customTemplate && typeof customTemplate === 'string' && customTemplate.trim()) {
    return customTemplate.trim();
  }
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

export function buildDuplicateRefusalDm(newGroupName, existingGroupName, customTemplate = null) {
  if (customTemplate && typeof customTemplate === 'string' && customTemplate.trim()) {
    return customTemplate
      .replace(/{newGroupName}/g, newGroupName)
      .replace(/{existingGroupName}/g, existingGroupName)
      .trim();
  }
  return [
    'Assalamu alaykum wa rahmatullah chère sœur / cher frère,',
    '',
    `Vous venez de tenter de rejoindre le groupe *${newGroupName}*, mais notre système a constaté que vous êtes déjà membre du groupe *${existingGroupName}*.`,
    '',
    'Afin de permettre au plus grand nombre de futurs pèlerins d’accéder aux échanges (les places étant limitées par WhatsApp) :',
    '👉 *Votre demande pour ce second groupe a été automatiquement refusée.*',
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
  isRequest = false,
  dmSent = false,
}) {
  const member = senderPhone ? `+${senderPhone} (${senderReference})` : senderReference;
  let actionText;
  if (isRequest) {
    actionText = dmSent
      ? 'Demande d’adhésion automatiquement rejetée + MP explicatif envoyé.'
      : 'Demande d’adhésion automatiquement rejetée (mode anti-ban : aucun MP envoyé).';
  } else {
    actionText = dmSent
      ? 'Membre automatiquement exclu du second groupe + MP explicatif envoyé.'
      : 'Membre automatiquement exclu du second groupe (mode anti-ban : aucun MP envoyé).';
  }
  return [
    '🛡️ *PROTECTION MULTI-GROUPES (DOUBLON REFUSÉ)*',
    `👤 *Membre :* ${member}`,
    `🚫 *Groupe tenté :* ${newGroupName}`,
    `✅ *Déjà présent dans :* ${existingGroupName}`,
    `⚙️ *Action :* ${actionText}`,
  ].join('\n');
}

export function normalizePhoneNumber(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (/^0[1-9]\d{8}$/.test(digits)) {
    return `33${digits.slice(1)}`;
  }
  return digits;
}

export function isPhoneExempt(phoneOrId, exemptList = []) {
  if (!phoneOrId || !Array.isArray(exemptList) || exemptList.length === 0) return false;
  const rawDigits = String(phoneOrId).split('@')[0].replace(/\D/g, '');
  const normalized = normalizePhoneNumber(rawDigits);

  return exemptList.some((item) => {
    const itemDigits = typeof item === 'string'
      ? item.replace(/\D/g, '')
      : String(item.normalized_phone || item.phone || '').replace(/\D/g, '');
    const itemNorm = normalizePhoneNumber(itemDigits);
    return (
      rawDigits === itemDigits ||
      normalized === itemNorm ||
      (itemNorm.length >= 9 && normalized.endsWith(itemNorm)) ||
      (normalized.length >= 9 && itemNorm.endsWith(normalized))
    );
  });
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

export function auditDuplicates(groupsData, exemptList = []) {
  const adminNumbers = new Set();
  const allPilgrims = new Map();

  // Add explicit exempt list to admin numbers whitelist
  for (const item of exemptList) {
    const itemDigits = typeof item === 'string'
      ? item.replace(/\D/g, '')
      : String(item.normalized_phone || item.phone || '').replace(/\D/g, '');
    const norm = normalizePhoneNumber(itemDigits);
    if (itemDigits) adminNumbers.add(itemDigits);
    if (norm) adminNumbers.add(norm);
  }

  // Step 1: identify all admins across all groups
  for (const group of groupsData) {
    for (const p of group.participants || []) {
      const phone = formatParticipantPhone(p);
      const normPhone = normalizePhoneNumber(phone);
      const key = phone || p.id;
      if (p.isAdmin || p.isSuperAdmin) {
        if (key) adminNumbers.add(key);
        if (phone) adminNumbers.add(phone);
        if (normPhone) adminNumbers.add(normPhone);
        if (p.id) adminNumbers.add(p.id);
      }
    }
  }

  // Step 2: map regular participants
  let totalPresences = 0;
  for (const group of groupsData) {
    for (const p of group.participants || []) {
      const phone = formatParticipantPhone(p);
      const normPhone = normalizePhoneNumber(phone);
      const key = phone || p.id;
      if (!key) continue;

      totalPresences += 1;
      // Skip admins/moderators or whitelisted
      if (
        adminNumbers.has(key) ||
        adminNumbers.has(phone) ||
        adminNumbers.has(normPhone) ||
        adminNumbers.has(p.id) ||
        isPhoneExempt(phone, exemptList) ||
        isPhoneExempt(p.id, exemptList)
      ) {
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

export function buildModeratorsListMessage(moderatorsList = []) {
  if (!moderatorsList.length) {
    return [
      '🛡️ *LISTE DES MODÉRATEURS & EXEMPTÉS*',
      '───────────────────────────',
      'Aucun modérateur n’est enregistré dans la liste d’exclusion.',
      '',
      'ℹ️ _Vous pouvez ajouter des numéros depuis la console web /admin dans l’onglet « 🛡️ Modérateurs & Exemptés »._',
    ].join('\n');
  }

  const lines = [
    '🛡️ *LISTE DES MODÉRATEURS & EXEMPTÉS*',
    '───────────────────────────',
    `Total enregistrés : ${moderatorsList.length}`,
    'ℹ️ _Ces numéros sont autorisés dans tous les groupes sans être exclus._',
    '',
  ];

  moderatorsList.forEach((m, idx) => {
    const labelPart = m.label ? ` — *${m.label}*` : '';
    lines.push(`${idx + 1}. ${m.phone}${labelPart}`);
  });

  return lines.join('\n');
}

export function isPhoneBanned(phoneOrId, bannedList = []) {
  if (!phoneOrId || !Array.isArray(bannedList) || bannedList.length === 0) return false;
  const rawDigits = String(phoneOrId).split('@')[0].replace(/\D/g, '');
  const normalized = normalizePhoneNumber(rawDigits);

  return bannedList.some((item) => {
    const itemDigits = typeof item === 'string'
      ? item.replace(/\D/g, '')
      : String(item.normalized_phone || item.phone || '').replace(/\D/g, '');
    const itemNorm = normalizePhoneNumber(itemDigits);
    return (
      rawDigits === itemDigits ||
      normalized === itemNorm ||
      (itemNorm.length >= 9 && normalized.endsWith(itemNorm)) ||
      (normalized.length >= 9 && itemNorm.endsWith(normalized))
    );
  });
}

export function detectResourceMention(rawText, resourcesList = []) {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;
  const clean = normalizeText(rawText);
  const trimmed = rawText.trim();

  // 1. Direct command shortcut, e.g. !youtube, !site, !faq, !hotels, !packages, !liens
  const cmdMatch = trimmed.match(/^[!/]([a-zA-Z0-9_\-]+)$/);
  if (cmdMatch) {
    const cmd = cmdMatch[1].toLowerCase();
    if (cmd === 'liens' || cmd === 'ressources' || cmd === 'all') {
      return { type: 'all' };
    }
    const found = resourcesList.find((r) => {
      if (r.id.toLowerCase() === cmd) return true;
      if (Array.isArray(r.keywords) && r.keywords.some((k) => normalizeText(k) === cmd)) return true;
      return false;
    });
    if (found) {
      return { type: 'resource', resource: found };
    }
  }

  // 2. Natural language detection based on keywords
  for (const r of resourcesList) {
    const keywords = Array.isArray(r.keywords) ? r.keywords : [];
    for (const kw of keywords) {
      const cleanKw = normalizeText(kw);
      if (!cleanKw) continue;
      const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s|[.,;:!?()'])${escaped}($|\\s|[.,;:!?()'])`, 'i');
      if (regex.test(clean)) {
        return { type: 'resource', resource: r, matchedKeyword: kw };
      }
    }
  }

  return null;
}

export function buildResourceMessage(resource) {
  return [
    `📌 *${(resource.title || '').toUpperCase()}*`,
    '───────────────────────────',
    resource.description || '',
    '',
    `👉 *Lien officiel :* ${resource.url || ''}`,
    '───────────────────────────',
    'ℹ️ _Ressource officielle partagée par l’équipe Entraide Nusuk Hajj._',
  ].join('\n');
}

export function buildAllResourcesMessage(resourcesList = []) {
  const lines = [
    '📚 *RESSOURCES & LIENS OFFICIELS ENTRAIDE NUSUK HAJJ*',
    '───────────────────────────',
    'Retrouvez l’ensemble de nos guides, vidéos et outils pratiques pour votre Hajj :',
    '',
  ];
  resourcesList.forEach((r) => {
    lines.push(`🔹 *${r.title}*`);
    if (r.description) lines.push(`   ${r.description}`);
    lines.push(`   👉 ${r.url}`);
    lines.push('');
  });
  lines.push('───────────────────────────');
  lines.push('ℹ️ _Tous nos contenus sont 100% gratuits et indépendants._');
  return lines.join('\n');
}

export function buildStatusReport({
  sessionConnected = true,
  sessionDetails = null,
  monitoredGroups = [],
  antiBanEnabled = true,
  scheduleTimes = { lock: '23h00', unlock: '07h00', recap: '20h10' },
  recapInfo = null,
  moderatorsCount = 0,
  bannedCount = 0,
}) {
  const sessionStatusStr = sessionConnected ? '🟢 Connecté' : '🔴 Déconnecté';
  const sessionInfo = sessionDetails ? ` (${sessionDetails})` : '';
  const antiBanStr = antiBanEnabled
    ? '🟢 ACTIF (0 MP privé envoyé — anti-ban strict)'
    : '⚠️ DÉSACTIVÉ (envoi de MP privé autorisé)';

  const lines = [
    '📊 *ÉTAT DU SYSTÈME XHATSAPP*',
    '───────────────────────────',
    `📱 *Session WhatsApp :* ${sessionStatusStr}${sessionInfo}`,
    `🛡️ *Protection Anti-Ban :* ${antiBanStr}`,
    '',
    `👥 *Groupes Surveillés (${monitoredGroups.length}) :*`,
  ];

  if (monitoredGroups.length === 0) {
    lines.push('_(Aucun groupe surveillé configuré)_');
  } else {
    let totalParticipants = 0;
    monitoredGroups.forEach((g) => {
      const pCount = g.participantCount ?? g.participantsCount ?? '?';
      if (typeof pCount === 'number') totalParticipants += pCount;
      const lockState = g.isAnnounce ? '🔒 Verrouillé' : '🔓 Ouvert';
      lines.push(`• *${g.name}* : ${pCount} membres (${lockState})`);
    });
    if (totalParticipants > 0) {
      lines.push(`📊 *Total pèlerins :* ~${totalParticipants} membres`);
    }
  }

  lines.push('');
  lines.push('🕒 *Automatisations (Europe/Paris) :*');
  lines.push(`• 📰 Récapitulatif quotidien : ${scheduleTimes.recap || '20h10'}${recapInfo ? ` [${recapInfo}]` : ''}`);
  lines.push(`• 🔒 Fermeture nocturne : ${scheduleTimes.lock || '23h00'}`);
  lines.push(`• 🔓 Réouverture matinale : ${scheduleTimes.unlock || '07h00'}`);

  lines.push('');
  lines.push('🛡️ *Modération & Sécurité :*');
  lines.push(`• Modérateurs / Exemptés : ${moderatorsCount} numéro(s)`);
  lines.push(`• Membres bannis (Liste noire) : ${bannedCount} numéro(s)`);
  lines.push('───────────────────────────');
  lines.push('💡 _Commandes :_ *DOUBLONS*, *LISTE BAN*, *BAN <numéro>*, *UNBAN <numéro>*, *MODERATEURS*, *BLOCK ALL*, *UNBLOCK ALL*, *RESSOURCES*');

  return lines.join('\n');
}

export function buildBanSuccessMessage({ phone, reason, kickedGroups = [] }) {
  const kickSummary = kickedGroups.length > 0
    ? `Expulsé de ${kickedGroups.length} groupe(s) : [${kickedGroups.join(', ')}]`
    : 'Non présent actuellement dans les groupes surveillés';

  return [
    '🚫 *MEMBRE BANNI AVEC SUCCÈS*',
    '───────────────────────────',
    `👤 *Numéro :* +${phone}`,
    `📝 *Raison :* ${reason || 'Non précisée'}`,
    `🚪 *Action immédiate :* ${kickSummary}`,
    '🛡️ *Statut :* Numéro ajouté à la liste noire permanente.',
    'Toute tentative future de rejoindre nos groupes sera automatiquement rejetée.',
  ].join('\n');
}

export function buildBannedListMessage(bannedList = []) {
  if (!bannedList.length) {
    return [
      '🚫 *LISTE NOIRE DES MEMBRES BANNIS*',
      '───────────────────────────',
      'Aucun membre n’est actuellement sur la liste noire.',
      '',
      'ℹ️ _Pour bannir un numéro indésirable :_ *BAN <numéro> [raison]*',
    ].join('\n');
  }

  const lines = [
    '🚫 *LISTE NOIRE DES MEMBRES BANNIS*',
    '───────────────────────────',
    `Total : ${bannedList.length} numéro(s) interdit(s)`,
    '',
  ];

  bannedList.forEach((b, idx) => {
    const reason = b.reason ? ` (${b.reason})` : '';
    lines.push(`${idx + 1}. +${b.normalized_phone || b.phone}${reason}`);
  });

  lines.push('');
  lines.push('ℹ️ _Pour lever un bannissement :_ *UNBAN <numéro>*');
  return lines.join('\n');
}

export function buildBannedAttemptAlert({ phone, senderReference, groupName, isRequest = false }) {
  const member = phone ? `+${phone} (${senderReference})` : senderReference;
  const action = isRequest
    ? 'Demande d’adhésion automatiquement rejetée (numéro sur liste noire).'
    : 'Membre automatiquement expulsé (numéro sur liste noire).';

  return [
    '🚫 *ALERTE : TENTATIVE D’ACCÈS PAR UN MEMBRE BANNI*',
    `👤 *Membre :* ${member}`,
    `📍 *Groupe :* ${groupName}`,
    `⚙️ *Action :* ${action}`,
  ].join('\n');
}


