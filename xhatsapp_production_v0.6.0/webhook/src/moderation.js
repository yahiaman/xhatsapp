import { randomBytes } from 'node:crypto';

const RULES = {
  agency: [
    'agence', 'agency',
    'وكالة', 'وكاله', 'شركة', 'شركه',
  ],
  donation: [
    'don', 'dons', 'donation', 'cagnotte', 'collecte',
    'sadaqa', 'sadaka', 'sadaqah', 'zakat', 'aumone', 'aumône',
    'leetchi', 'cotizup', 'gofundme', 'paypal', 'lydia',
    'rib', 'iban', 'virement', 'western union', 'moneygram',
    'fidya', 'kaffara',
    'تبرع', 'تبرعات', 'صدقة', 'صدقه', 'زكاة',
  ],
  advertising: [
    'offre', 'promotion', 'promo', 'prix', 'tarif', 'reservation',
    'reservez', 'disponible', 'vente', 'forfait', 'package', 'hotel',
    'hebergement', 'chambre', 'vol', 'visa',
    'عرض', 'سعر', 'متوفر', 'متاح', 'حجز', 'فندق', 'غرفة', 'ريال',
  ],
};

export const DEFAULT_FORBIDDEN_AGENCIES = [
  'ACMUV', 'Al Amana', 'Al Bouraq', 'Al Fadjri', 'Al Minbar', 'Al Mourafiq', 'Al Qafila',
  'Al Raad Tour', 'Al Sirate Voyages', 'Al Wafa', 'Arafat Voyages', 'Ariane Voyages',
  'Asfar Travel France', 'Assafar Voyages', 'Association Nour', 'Autre Voyage',
  'Autre Voyage Falah Darain', 'Azmi', 'Bel Agir', 'Booking Makkah', 'Carnot Voyages',
  'Chayma Travel', 'Fatima', 'CIDRA', 'Classy Travel', 'Dar Hajj', 'DGP', 'Djamila Voyage',
  'El Hayat', 'El Rajhi', 'Essakina Voyage', 'Favela', 'Go Makkah', 'Groupe Al Quds',
  'Hajj Oumra TV', 'Haramain Voyages', 'Haramein Voyages', 'Haramayn Voyages',
  'Hawwa Travel', 'Hedjaz', 'Hégire Voyage', 'Hikma Travel', 'Histoires Saintes',
  'Ibtisama', 'Ibtisama Travel', 'Jawaz', 'Jil Voyages', 'Kawtar Voyages', 'Labayk',
  'Labayk Travel', 'Maison du Hajj', 'Maison Blanche', 'Mawasem', 'Mon Hajj',
  'Mon Guide Hajj', 'Nabi Voyages', 'Nawassik', 'Noor Travel', 'Nouvelles Frontières',
  'Nouveau Regard', 'Oia Voyages', 'Omra Privée', 'Palma', 'Prisme Travel', 'Rissala',
  'Safra Travel', 'Salsabil Travel', 'Selectour', 'Sirat Travel', 'Soussi Travel',
  'Tahafut', 'Tawhid Travel', 'Tawva Voyages', 'Transalp', 'Traveler Spirit',
  'Trip In Makkah', 'Umrah and Hajj Tour', 'Voie Directe', 'Voyage De Rêve',
  'Voyages Essalam', 'Voyages MN', 'France Nusuk',
];

const HUMANITARIAN_PHRASES = [
  'aider les pauvres', 'aide aux pauvres', 'aider des pauvres', 'pour les pauvres',
  'nourrir les pauvres', 'repas pour les pauvres', 'nourrir des pauvres',
  'aider les orphelins', 'aide aux orphelins', 'parrainer un orphelin', 'parrainage orphelin',
  'creuser un puits', 'construire un puits', 'forage de puits', 'projet puits',
  'colis alimentaire', 'colis alimentaires', 'panier alimentaire',
  'sadaka jariya', 'sadaqa jariya', 'sadaka djariya',
  'aide humanitaire', 'urgence humanitaire', 'appel aux dons', 'faire un don',
  'appel au don', 'collecte de dons', 'envoyez vos dons',
];

const AID_WORDS = ['aider', 'aide', 'soutenir', 'soutien', 'don', 'dons', 'donner', 'collecte', 'urgence', 'pauvres', 'orphelins', 'famine', 'necessiteux'];
const SENSITIVE_ZONES = ['somali', 'somalie', 'gaza', 'palestine', 'yemen', 'soudan', 'syrie', 'rohingya', 'afrique'];

const LATIN_TERM = /^[a-z0-9 ]+$/;

export function normalizeForModeration(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(text, term) {
  if (!LATIN_TERM.test(term)) return text.includes(term);
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}([^a-z0-9]|$)`, 'i').test(text);
}

function matches(text, terms) {
  return terms.filter((term) => containsTerm(text, term));
}

function hasHumanitarianAppeal(text) {
  if (HUMANITARIAN_PHRASES.some((phrase) => text.includes(phrase))) return true;
  const hasAid = AID_WORDS.some((word) => containsTerm(text, word));
  const hasZone = SENSITIVE_ZONES.some((zone) => containsTerm(text, zone));
  return hasAid && hasZone;
}

function isExemptAgency(text, term) {
  if (term === 'agence' && (text.includes('sans agence') || text.includes('sans-agence'))) {
    return true;
  }
  return false;
}

function hasContactOrPriceSignal(original, normalized) {
  return /https?:\/\/|www\.|wa\.me\//i.test(original)
    || /(?:\+?\d[\s().-]*){8,}/.test(original)
    || /(?:€|eur\b|sar\b|﷼|ريال)/i.test(original)
    || /\b\d{2,5}(?:[.,]\d{1,2})?\b/.test(normalized);
}

export function detectModeration(value, customAgencies = []) {
  const original = String(value || '');
  const text = normalizeForModeration(original);
  if (!text) return { flagged: false, categories: [], matchedTerms: [], isForbiddenAgency: false, matchedAgencies: [] };

  const allAgencies = [...new Set([...DEFAULT_FORBIDDEN_AGENCIES, ...customAgencies])];
  const matchedAgencies = [];
  for (const agency of allAgencies) {
    const normalized = normalizeForModeration(agency);
    if (!normalized) continue;
    if (normalized === 'nusuk' || normalized === 'entraide nusuk hajj' || normalized === 'sans agence' || normalized === 'ithraa al khair') continue;
    if (containsTerm(text, normalized)) {
      matchedAgencies.push(agency);
    }
  }

  const isForbiddenAgency = matchedAgencies.length > 0;
  let agency = matches(text, RULES.agency).filter((term) => !isExemptAgency(text, term));
  if (matchedAgencies.length) {
    agency = [...new Set([...agency, ...matchedAgencies.map((a) => a.toLowerCase())])];
  }

  const donation = matches(text, RULES.donation);
  if (hasHumanitarianAppeal(text)) {
    donation.push('appel_humanitaire');
  }

  const advertising = matches(text, RULES.advertising);
  const categories = [];

  if (isForbiddenAgency) {
    categories.push('agency_citation');
  } else if (agency.length) {
    categories.push('agency');
  }

  if (donation.length) categories.push('donation');
  if (advertising.length >= 2
      || (advertising.length >= 1 && hasContactOrPriceSignal(original, text))) {
    categories.push('advertising');
  }

  return {
    flagged: categories.length > 0,
    categories,
    matchedTerms: [...new Set([...agency, ...donation, ...advertising])],
    isForbiddenAgency,
    matchedAgencies,
    matchedAgency: matchedAgencies[0] || null,
  };
}

export function createAlertCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

export function parseModerationCommand(value) {
  const match = String(value || '').trim().toUpperCase()
    .match(/^(SUPPRIMER|IGNORER)\s+([A-Z0-9]{6})$/);
  if (!match) return null;
  return {
    action: match[1] === 'SUPPRIMER' ? 'delete' : 'ignore',
    code: match[2],
  };
}

export function buildModerationAlert({
  code, categories, groupName, groupReference, senderName, text, autoDeleted = false, matchedAgencies = [],
}) {
  const labels = {
    agency: 'agence ou prestataire',
    agency_citation: 'citation d’agence interdite',
    donation: 'don, cagnotte ou appel aux dons',
    advertising: 'publicité ou offre commerciale',
  };
  const excerpt = String(text || '(message sans texte)').slice(0, 1500);

  if (autoDeleted) {
    const agencyLabel = matchedAgencies.length
      ? `Agence(s) détectée(s) : *${matchedAgencies.join(', ')}*`
      : 'Agence interdite détectée';
    return [
      '🛡️ *Modération automatique Xhatsapp*',
      '',
      `📋 *Motif :* ${categories.map((category) => labels[category] || category).join(', ')}`,
      `🏢 *${agencyLabel}*`,
      `👥 *Groupe :* ${groupName || '(sans nom)'} (${groupReference})`,
      `👤 *Auteur :* ${senderName || 'Membre non identifié'}`,
      '',
      '💬 *Contenu du message supprimé :*',
      '----------------------------------------',
      excerpt,
      '----------------------------------------',
      '',
      '✅ *Actions effectuées :*',
      '• Message supprimé automatiquement dans le groupe.',
      '• Rappel de neutralité envoyé aux participants.',
      '',
      'ℹ️ _Si c’est un faux positif, vous pouvez ajuster le dictionnaire sur l’interface /admin._',
    ].join('\n');
  }

  return [
    '🚨 *Alerte de modération Xhatsapp*',
    '',
    `🏷️ *Référence :* ${code}`,
    `📋 *Motif :* ${categories.map((category) => labels[category] || category).join(', ')}`,
    `👥 *Groupe :* ${groupName || '(sans nom)'} (${groupReference})`,
    `👤 *Auteur :* ${senderName || 'Membre non identifié'}`,
    '',
    '💬 *Contenu du message signalé :*',
    '----------------------------------------',
    excerpt,
    '----------------------------------------',
    '',
    '⚠️ *Décision humaine requise :*',
    `👉 Pour supprimer : *SUPPRIMER ${code}*`,
    `👉 Pour conserver : *IGNORER ${code}*`,
  ].join('\n');
}
