import { randomBytes } from 'node:crypto';

export function createRecapCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function parseRecapCommand(text) {
  const normalized = String(text || '').trim().toUpperCase();
  const match = normalized.match(/^(GO|ANNULER|REESSAYER|RÉESSAYER)\s+RECAP\s+([A-Z0-9]{6})$/u);
  if (!match) return null;
  const action = match[1] === 'GO' ? 'publish' : (match[1] === 'ANNULER' ? 'cancel' : 'retry');
  return { action, code: match[2] };
}

export function localDateAndTime(date = new Date(), timezone = 'Europe/Paris') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return {
    localDate: `${value('year')}-${value('month')}-${value('day')}`,
    localTime: `${value('hour')}:${value('minute')}`,
  };
}

export function recapIsDue(settings, date = new Date()) {
  const current = localDateAndTime(date, settings.timezone);
  return current.localTime >= settings.runTime
    ? current.localDate
    : null;
}

export function splitMessages(messages, maxCharacters = 12_000) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const message of messages) {
    const groupPrefix = message.group_name ? `[${message.group_name}] ` : '';
    const line = `[${message.time}] ${groupPrefix}${message.body}`.slice(0, 2_000);
    if (current.length && size + line.length + 1 > maxCharacters) {
      chunks.push(current.join('\n'));
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length) chunks.push(current.join('\n'));
  return chunks;
}

export function formatFrenchDate(isoDate) {
  try {
    const [y, m, day] = String(isoDate || '').split('-').map(Number);
    if (!y || !m || !day) return isoDate;
    const date = new Date(y, m - 1, day, 12);
    const formatted = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return isoDate;
  }
}

export function appendSignature(summary, signature, maxLength = 3_500) {
  const cleanSummary = String(summary || '').trim();
  const cleanSignature = String(signature || '').trim();
  const suffix = cleanSignature ? `\n\n${cleanSignature}` : '';
  return `${cleanSummary.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`.slice(0, maxLength);
}

export function buildRecapPreview({ code, localDate, deliveries }) {
  const destinations = deliveries.map((item) => `• ${item.name} (${item.reference})`).join('\n');
  const friendlyDate = formatFrenchDate(localDate);
  const count = deliveries[0]?.messageCount || deliveries.reduce((sum, item) => sum + (item.messageCount || 0), 0);
  return [
    `📋 *Récapitulatif consolidé — ${friendlyDate}*`,
    `${deliveries.length} groupe(s) destinataire(s), ${count} message(s) analysé(s).`,
    '',
    'Destinations :',
    destinations,
    '',
    `Pour valider et diffuser : *GO RECAP ${code}*`,
    `Pour annuler : *ANNULER RECAP ${code}*`,
  ].join('\n');
}

export function createSummaryClient({
  provider = 'omniroute', baseUrl, apiKey = '', model, timeoutMs = 15 * 60_000,
}) {
  const root = String(baseUrl).replace(/\/+$/, '');
  async function generate(prompt, numPredict) {
    const system = [
      'Tu es le rédacteur officiel des récapitulatifs quotidiens pour les groupes WhatsApp d’entraide du Hajj et de la Omra.',
      'Tu rédiges exclusivement en français un point d’information factuel, clair, chaleureux et bienveillant.',
      'Objectif : permettre aux pèlerins qui rentrent le soir du travail d’être rapidement à jour sur l’état d’avancement de la saison du Hajj et les conseils utiles.',
      'Règles absolues de rédaction :',
      '- Utilise EXCLUSIVEMENT le balisage WhatsApp (*texte en gras*, _texte en italique_). Ne jamais utiliser de syntaxe markdown comme #, ##, **, ou des séparateurs horizontaux (---).',
      '- Déduplique les sujets posés dans plusieurs groupes pour n’en faire qu’une synthèse unique.',
      '- N’invente absolument rien, ne cite aucun numéro de téléphone ni identifiant technique, et évite les noms de personnes.',
      '- Si une rubrique n’a aucune matière ce jour-là, OMTS-LA INTÉGRALEMENT. Ne jamais écrire "Aucune information" ou "Rien à signaler".',
    ].join(' ');
    const isOllama = provider === 'ollama';
    if (!['omniroute', 'ollama'].includes(provider)) throw new Error('summary_provider_invalid');
    if (!model || model === 'pending') throw new Error('summary_model_not_configured');
    if (!isOllama && (!apiKey || apiKey === 'pending')) throw new Error('summary_api_key_not_configured');
    const response = await fetch(isOllama ? `${root}/api/generate` : `${root}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isOllama ? {} : {
          Authorization: `Bearer ${apiKey}`,
          'X-OmniRoute-No-Cache': 'true',
        }),
      },
      body: JSON.stringify(isOllama ? {
        model, system, prompt, stream: false, think: false, keep_alive: 0,
        options: { num_ctx: 8192, num_predict: numPredict, temperature: 0.2, top_p: 0.9 },
      } : {
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        stream: false,
        max_tokens: numPredict,
        temperature: 0.2,
        top_p: 0.9,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => ({}));
    const output = isOllama ? payload.response : payload?.choices?.[0]?.message?.content;
    if (!response.ok || typeof output !== 'string') throw new Error(`summary_http_${response.status}`);
    return output.trim();
  }
  return { generate };
}

export async function summarizeConsolidated({ summaryClient, localDate, messages }) {
  const chunks = splitMessages(messages);
  const partials = [];
  const friendlyDate = formatFrenchDate(localDate);
  for (let index = 0; index < chunks.length; index += 1) {
    partials.push(await summaryClient.generate([
      `Date : ${localDate}`,
      `Partie ${index + 1}/${chunks.length}`,
      'Extrais fidèlement les informations utiles, l\'avancement officiel de la saison du Hajj, les réponses de l\'équipe et les questions encore ouvertes.',
      'Ignore les salutations de politesse isolées, les doublons et les bavardages hors-sujet.',
      '', chunks[index],
    ].join('\n'), 600));
  }
  return summaryClient.generate([
    `Rédige le point d'information quotidien pour les pèlerins du Hajj pour le ${friendlyDate}.`,
    '',
    'Structure et modèle à suivre (adapte selon les faits réels extraits) :',
    '🕌 *Point du jour — Saison Hajj*',
    `📅 *${friendlyDate}*`,
    '',
    'Assalāmu ʿalaykum,',
    'Voici l\'essentiel des échanges du jour pour faire le point sur la préparation du Hajj :',
    '',
    '📢 *État d\'avancement & Annonces officielles :*',
    '• [Synthèse des démarches : ouverture Nusuk, inscriptions, visas, consignes officielles. Omets entièrement cette rubrique si aucune annonce.]',
    '',
    '💡 *Informations utiles & Réponses de l\'équipe :*',
    '• [Conseils pratiques, réponses concrètes données aux questions des pèlerins, rappels importants. Omets entièrement cette rubrique si rien.]',
    '',
    '⏳ *Questions en attente de confirmation :*',
    '• [Points en cours qui seront confirmés prochainement. Omets entièrement cette rubrique si tout est clair.]',
    '',
    '_L\'équipe vous souhaite une excellente soirée et reste à votre écoute._',
    '',
    'Contraintes strictes :',
    '- Utilise uniquement *titre en gras* et des puces • claires.',
    '- Omets toute rubrique qui n\'a pas de contenu réel (n\'écris jamais "Aucune annonce").',
    '- Longueur maximale : 2 500 caractères.',
    '', partials.join('\n\n---\n\n'),
  ].join('\n'), 900);
}

export async function summarizeGroup({ summaryClient, groupName, localDate, messages }) {
  return summarizeConsolidated({ summaryClient, localDate, messages });
}
