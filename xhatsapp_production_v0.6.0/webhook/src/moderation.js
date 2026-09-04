import { randomBytes } from 'node:crypto';

const RULES = {
  agency: [
    'agence', 'agency', 'provider', 'prestataire',
    'وكالة', 'وكاله', 'شركة', 'شركه',
  ],
  donation: [
    'don', 'dons', 'donation', 'cagnotte', 'collecte',
    'sadaqa', 'sadaka', 'zakat', 'تبرع', 'تبرعات', 'صدقة', 'صدقه', 'زكاة',
  ],
  advertising: [
    'offre', 'promotion', 'promo', 'prix', 'tarif', 'reservation',
    'reservez', 'disponible', 'vente', 'forfait', 'package', 'hotel',
    'hebergement', 'chambre', 'vol', 'visa',
    'عرض', 'سعر', 'متوفر', 'متاح', 'حجز', 'فندق', 'غرفة', 'ريال',
  ],
};

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

function hasContactOrPriceSignal(original, normalized) {
  return /https?:\/\/|www\.|wa\.me\//i.test(original)
    || /(?:\+?\d[\s().-]*){8,}/.test(original)
    || /(?:€|eur\b|sar\b|﷼|ريال)/i.test(original)
    || /\b\d{2,5}(?:[.,]\d{1,2})?\b/.test(normalized);
}

export function detectModeration(value) {
  const original = String(value || '');
  const text = normalizeForModeration(original);
  if (!text) return { flagged: false, categories: [], matchedTerms: [] };

  const agency = matches(text, RULES.agency);
  const donation = matches(text, RULES.donation);
  const advertising = matches(text, RULES.advertising);
  const categories = [];

  if (agency.length) categories.push('agency');
  if (donation.length) categories.push('donation');
  if (advertising.length >= 2
      || (advertising.length >= 1 && hasContactOrPriceSignal(original, text))) {
    categories.push('advertising');
  }

  return {
    flagged: categories.length > 0,
    categories,
    matchedTerms: [...new Set([...agency, ...donation, ...advertising])],
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

export function buildModerationAlert({ code, categories, groupName, groupReference, senderName, text }) {
  const labels = {
    agency: 'agence ou prestataire',
    donation: 'don ou collecte',
    advertising: 'publicité ou offre commerciale',
  };
  const excerpt = String(text || '(message sans texte)').slice(0, 1200);
  return [
    '🚨 Alerte de modération Xhatsapp',
    '',
    `Référence : ${code}`,
    `Motif : ${categories.map((category) => labels[category] || category).join(', ')}`,
    `Groupe : ${groupName || '(sans nom)'} (${groupReference})`,
    `Auteur : ${senderName || 'Membre non identifié'}`,
    '',
    'Message signalé :',
    excerpt,
    '',
    'Décision humaine requise :',
    `IGNORER ${code}`,
    `SUPPRIMER ${code}`,
  ].join('\n');
}
