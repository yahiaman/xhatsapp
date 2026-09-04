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
    const line = `[${message.time}] ${message.body}`.slice(0, 2_000);
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

export function appendSignature(summary, signature, maxLength = 3_500) {
  const cleanSummary = String(summary || '').trim();
  const cleanSignature = String(signature || '').trim();
  const suffix = cleanSignature ? `\n\n${cleanSignature}` : '';
  return `${cleanSummary.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`.slice(0, maxLength);
}

export function buildRecapPreview({ code, localDate, deliveries }) {
  const destinations = deliveries.map((item) => `• ${item.name} (${item.reference})`).join('\n');
  return [
    `📋 Récapitulatif du ${localDate}`,
    `${deliveries.length} groupe(s), ${deliveries.reduce((sum, item) => sum + item.messageCount, 0)} message(s).`,
    '', destinations, '',
    `Validation : GO RECAP ${code}`,
    `Annulation : ANNULER RECAP ${code}`,
  ].join('\n');
}

export function createSummaryClient({
  provider = 'omniroute', baseUrl, apiKey = '', model, timeoutMs = 15 * 60_000,
}) {
  const root = String(baseUrl).replace(/\/+$/, '');
  async function generate(prompt, numPredict) {
    const system = 'Tu rédiges des récapitulatifs WhatsApp factuels, sobres et exclusivement en français. N’invente rien, ne cite aucun numéro ni identifiant technique et évite les noms de personnes.';
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

export async function summarizeGroup({ summaryClient, groupName, localDate, messages }) {
  const chunks = splitMessages(messages);
  const partials = [];
  for (let index = 0; index < chunks.length; index += 1) {
    partials.push(await summaryClient.generate([
      `Groupe : ${groupName}`,
      `Date : ${localDate}`,
      `Partie ${index + 1}/${chunks.length}`,
      'Résume uniquement les faits utiles, sujets abordés, réponses données et questions encore ouvertes. Ignore les salutations et répétitions.',
      '', chunks[index],
    ].join('\n'), 500));
  }
  return summaryClient.generate([
    `Rédige le récapitulatif final du groupe « ${groupName} » pour le ${localDate}.`,
    'Format : titre court, points importants, informations pratiques, questions sans réponse. Maximum 2 700 caractères. Si une rubrique est vide, omets-la.',
    '', partials.join('\n\n---\n\n'),
  ].join('\n'), 750);
}
