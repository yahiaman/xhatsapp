/**
 * AI-assisted moderation arbitration for Xhatsapp.
 * Leverages OmniRoute (or local LLM) with Few-Shot In-Context Learning
 * from human decisions (messages marked 'ignored' vs 'deleted').
 */

const SYSTEM_PROMPT = [
  'Tu es l’arbitre IA de modération pour des groupes WhatsApp d’entraide francophones dédiés au Hajj et à la Omra (plateforme saoudienne officielle Nusuk).',
  'Ta mission est d’éliminer les faux positifs pour éviter de déranger inutilement les modérateurs bénévoles.',
  '',
  'RÈGLES D’ARBITRAGE DU GROUPE :',
  '1. SONT STRICTEMENT INTERDITS (Infractions réelles) :',
  '- Démarchage ou promotion d’agences de voyages privées, rabatteurs, numéros de contact commerciaux.',
  '- Publicités commerciales, offres d’hôtels privées, vente de forfaits ou de packages hors plateforme officielle Nusuk.',
  '- Appels aux dons, cagnottes solidaires (Leetchi, Cotizup, PayPal, etc.), partage de RIB ou demandes de virement financier.',
  '',
  '2. SONT TOTALEMENT AUTORISÉS (Faux positifs fréquents à NE PAS sanctionner) :',
  '- Questions d’entraide entre pèlerins : démarches Nusuk, création de compte, validation de profil, types de visa (court séjour, touristique, Omra).',
  '- Questions de débutants sur le rôle des agences ("est-ce qu’on doit choisir une agence ?", "je ne connais aucune agence", "le passeport est gardé par qui ?").',
  '- Discussions bancaires et change de devises : utilisation de Revolut, rechargement du e-wallet Nusuk en SAR, cours EUR/SAR.',
  '- Questions logistiques ordinaires : hôtels, hébergement à Mina, chambres doubles vs quadruples, transports, météo.',
  '- Signalements d’arnaques ou de fraudes par un membre pour alerter les modérateurs.',
  '- Témoignages personnels sur le pèlerinage et remerciements.',
  '',
  'Réponds UNIQUEMENT sous la forme d’un objet JSON valide au format exact suivant :',
  '{"is_violation": false, "confidence": 0.95, "reason": "Courte explication en français"}',
].join('\n');

const DEFAULT_FALLBACK_EXAMPLES = {
  falsePositives: [
    'Est-ce qu’on doit choisir une agence pour partir au hajj ?',
    'Slm aleykoum j\'ai une question lors de l\'inscription il demande si on a déjà obtenu un visa antérieurement...',
    'Sinon je pense que les prix 2027 par rapport à 2026 seront plus chers vu le contexte géopolitique...',
    'Tu peux ouvrir un compte Revolut c’est le meilleurs rapport qualité prix',
    'Je ne suis pas disponible pour faire ces démarches avant dimanche prochain (4 octobre)',
    'J’ai été sincèrement bluffé par l’organisation, l’hébergement, la sécurité... ampleur remarquable',
  ],
  trueViolations: [
    'Aidez-nous sur cette cagnotte https://www.leetchi.com/c/hajj-solidaire pour les nécessiteux',
    'Envoyez vos dons par virement sur le RIB suivant : FR76...',
    'Notre agence propose des packages VIP Omra à 1200€, contactez-nous sur WhatsApp au 06...',
    'Hôtel 5 étoiles disponible à La Mecque, réservez votre chambre au meilleur tarif',
    'Contactez l’agence Al Sirate Voyages pour vos forfaits Hajj 2026',
  ],
};

export function buildAiModerationPrompt(messageText, categories = [], matchedTerms = [], examples = {}) {
  const fps = (examples.falsePositives?.length ? examples.falsePositives : DEFAULT_FALLBACK_EXAMPLES.falsePositives).slice(0, 5);
  const tvs = (examples.trueViolations?.length ? examples.trueViolations : DEFAULT_FALLBACK_EXAMPLES.trueViolations).slice(0, 5);

  const fpText = fps.map((msg, i) => `Exemple FP ${i + 1} : "${String(msg).replace(/\n+/g, ' ').slice(0, 200)}" -> FAUX POSITIF (Accepté)`).join('\n');
  const tvText = tvs.map((msg, i) => `Exemple Spam ${i + 1} : "${String(msg).replace(/\n+/g, ' ').slice(0, 200)}" -> VRAIE INFRACTION (Supprimé)`).join('\n');

  return [
    'Voici des exemples réels de messages précédemment arbitrés par les administrateurs de ce groupe :',
    '--- EXEMPLES DE FAUX POSITIFS ACCEPTÉS PAR LES ADMINS ---',
    fpText,
    '',
    '--- EXEMPLES DE VRAIES INFRACTIONS SUPPRIMÉES PAR LES ADMINS ---',
    tvText,
    '',
    `Un filtre par mots-clés a pré-signalé le message ci-dessous avec les catégories : [${categories.join(', ')}] et les termes suspects : [${matchedTerms.join(', ')}].`,
    '',
    'Message du membre à arbitrer :',
    '"""',
    String(messageText || '').slice(0, 1500),
    '"""',
    '',
    'Détermine si ce message est une VRAIE INFRACTION ou un FAUX POSITIF (discussion/entraide légitime).',
    'Format JSON strict attendu :',
    '{"is_violation": true/false, "confidence": 0.0-1.0, "reason": "Raison brève"}',
  ].join('\n');
}

export function parseAiModerationResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.is_violation !== 'boolean') {
      return null;
    }
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.8;
    const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim().slice(0, 250)
      : (parsed.is_violation ? 'Infraction commerciale suspectée' : 'Discussion d’entraide légitime');
    return {
      isViolation: parsed.is_violation,
      confidence,
      reason,
      raw: rawText,
    };
  } catch {
    // If json parse failed, attempt regex extraction
    const matchViolation = rawText.match(/"is_violation"\s*:\s*(true|false)/i);
    const matchConfidence = rawText.match(/"confidence"\s*:\s*([0-9.]+)/i);
    const matchReason = rawText.match(/"reason"\s*:\s*"([^"]+)"/i);
    if (matchViolation) {
      return {
        isViolation: matchViolation[1].toLowerCase() === 'true',
        confidence: matchConfidence ? parseFloat(matchConfidence[1]) : 0.75,
        reason: matchReason ? matchReason[1].slice(0, 250) : '',
        raw: rawText,
      };
    }
    return null;
  }
}

export async function evaluateModerationWithAi({
  summaryClient,
  messageText,
  flaggedCategories = [],
  matchedTerms = [],
  getExamples = null,
  timeoutMs = 10_000,
}) {
  if (!summaryClient || typeof summaryClient.generate !== 'function') {
    return { isViolation: true, confidence: 0.5, reason: 'ai_client_not_configured', fallback: true };
  }

  let examples = DEFAULT_FALLBACK_EXAMPLES;
  if (typeof getExamples === 'function') {
    try {
      const fetched = await getExamples();
      if (fetched && (fetched.falsePositives?.length || fetched.trueViolations?.length)) {
        examples = fetched;
      }
    } catch (err) {
      console.warn('Failed to load dynamic moderation examples from DB', err?.message || err);
    }
  }

  const prompt = buildAiModerationPrompt(messageText, flaggedCategories, matchedTerms, examples);

  try {
    const rawResponse = await summaryClient.generate(prompt, 150, SYSTEM_PROMPT);
    const parsed = parseAiModerationResponse(rawResponse);
    if (parsed) {
      return parsed;
    }
    console.warn('AI moderation response was not valid JSON', { raw: rawResponse?.slice(0, 100) });
    return { isViolation: true, confidence: 0.5, reason: 'ai_response_parse_failed', fallback: true };
  } catch (error) {
    console.warn('AI moderation call failed, falling back to human review', { error: error?.message || error });
    return { isViolation: true, confidence: 0.5, reason: 'ai_evaluation_error', fallback: true };
  }
}
