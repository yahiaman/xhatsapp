import { randomBytes } from 'node:crypto';

export function createBroadcastCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

export function parseCommunicationDraft(value, hasMedia = false) {
  const normalized = String(value || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (String(lines[0] || '').trim().toUpperCase() !== 'COMMUNICATION') return null;
  const text = lines.slice(1).join('\n').trim();
  if (!text && !hasMedia) return { error: 'communication_empty' };
  if (text.length > 3500) return { error: 'communication_too_long' };
  return { text };
}

export function parseBroadcastCommand(value) {
  const match = String(value || '').trim().toUpperCase()
    .match(/^(PUBLIER|ANNULER|REESSAYER)\s+([A-Z0-9]{6})$/);
  if (!match) return null;
  const actions = {
    PUBLIER: 'publish',
    ANNULER: 'cancel',
    REESSAYER: 'retry',
  };
  return { action: actions[match[1]], code: match[2] };
}

export function buildBroadcastPreview({ code, text, destinations, mediaType }) {
  const targetLines = destinations.map((group) => (
    `• ${group.name || '(sans nom)'} (${group.reference})`
  ));
  const mediaLabel = mediaType === 'image' ? '📷 Image jointe' : (mediaType === 'video' ? '🎥 Vidéo jointe' : (mediaType ? '📎 Fichier joint' : null));
  return [
    '📣 Brouillon de communication Xhatsapp',
    '',
    `Référence : ${code}`,
    ...(mediaLabel ? [`Média : ${mediaLabel}`] : []),
    `Destinations figées : ${destinations.length}`,
    ...targetLines,
    '',
    'Message :',
    text || '_(Aucun texte)_',
    '',
    'Décision humaine requise :',
    `PUBLIER ${code}`,
    `ANNULER ${code}`,
  ].join('\n');
}

export function buildBroadcastSummary({ code, sent, failed }) {
  return [
    failed === 0 ? '✅ Diffusion terminée' : '⚠️ Diffusion partiellement terminée',
    `Référence : ${code}`,
    `Envoyé : ${sent}`,
    `Échec : ${failed}`,
    ...(failed > 0 ? [`Pour réessayer uniquement les échecs : REESSAYER ${code}`] : []),
  ].join('\n');
}
