import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiModerationPrompt,
  parseAiModerationResponse,
  evaluateModerationWithAi,
} from '../src/moderation_ai.js';

test('buildAiModerationPrompt builds prompt with few-shot examples', () => {
  const prompt = buildAiModerationPrompt(
    'Est-ce que je dois prendre une agence ?',
    ['agency'],
    ['agence'],
    {
      falsePositives: ['Question légitime de test'],
      trueViolations: ['Pub agence VIP de test'],
    },
  );
  assert.ok(prompt.includes('Question légitime de test'));
  assert.ok(prompt.includes('Pub agence VIP de test'));
  assert.ok(prompt.includes('Est-ce que je dois prendre une agence ?'));
  assert.ok(prompt.includes('Format JSON strict attendu'));
});

test('parseAiModerationResponse parses valid JSON without codeblocks', () => {
  const raw = '{"is_violation": false, "confidence": 0.95, "reason": "Question légitime"}';
  const result = parseAiModerationResponse(raw);
  assert.deepEqual(result, {
    isViolation: false,
    confidence: 0.95,
    reason: 'Question légitime',
    raw,
  });
});

test('parseAiModerationResponse parses JSON wrapped in markdown codeblock', () => {
  const raw = '```json\n{"is_violation": true, "confidence": 0.88, "reason": "Publicité commerciale illicite"}\n```';
  const result = parseAiModerationResponse(raw);
  assert.deepEqual(result, {
    isViolation: true,
    confidence: 0.88,
    reason: 'Publicité commerciale illicite',
    raw,
  });
});

test('parseAiModerationResponse falls back gracefully on non-json text with patterns', () => {
  const raw = 'Après analyse : "is_violation": false, "confidence": 0.9, "reason": "Discussion Nusuk"';
  const result = parseAiModerationResponse(raw);
  assert.equal(result.isViolation, false);
  assert.equal(result.confidence, 0.9);
  assert.equal(result.reason, 'Discussion Nusuk');
});

test('parseAiModerationResponse returns null on complete gibberish', () => {
  assert.equal(parseAiModerationResponse('Impossible de comprendre'), null);
});

test('evaluateModerationWithAi identifies a false positive correctly via mock client', async () => {
  const mockClient = {
    generate: async (prompt, maxTokens, system) => {
      assert.ok(system.includes('Tu es l’arbitre IA de modération'));
      assert.ok(prompt.includes('Question sur le visa'));
      return JSON.stringify({
        is_violation: false,
        confidence: 0.96,
        reason: 'Question technique légitime d’un pèlerin sur la procédure de visa Nusuk.',
      });
    },
  };

  const result = await evaluateModerationWithAi({
    summaryClient: mockClient,
    messageText: 'Question sur le visa 2026',
    flaggedCategories: ['advertising'],
    matchedTerms: ['visa'],
    getExamples: async () => ({
      falsePositives: ['J ai eu un visa en 2024'],
      trueViolations: ['Vente de visas sans quota'],
    }),
  });

  assert.equal(result.isViolation, false);
  assert.equal(result.confidence, 0.96);
  assert.ok(result.reason.includes('Question technique légitime'));
});

test('evaluateModerationWithAi identifies a true violation via mock client', async () => {
  const mockClient = {
    generate: async () => JSON.stringify({
      is_violation: true,
      confidence: 0.92,
      reason: 'Démarchage commercial d’un rabatteur d’agence de voyages.',
    }),
  };

  const result = await evaluateModerationWithAi({
    summaryClient: mockClient,
    messageText: 'Venez réserver chez notre agence super promo 500 sar',
    flaggedCategories: ['advertising', 'agency'],
    matchedTerms: ['agence', 'promo'],
  });

  assert.equal(result.isViolation, true);
  assert.equal(result.confidence, 0.92);
  assert.ok(result.reason.includes('Démarchage commercial'));
});

test('evaluateModerationWithAi falls back safely when LLM fails or is missing', async () => {
  // Missing client
  const fallbackNoClient = await evaluateModerationWithAi({
    summaryClient: null,
    messageText: 'Message quelconque',
  });
  assert.equal(fallbackNoClient.isViolation, true);
  assert.equal(fallbackNoClient.fallback, true);

  // Throwing client
  const failingClient = {
    generate: async () => { throw new Error('omniroute_timeout'); },
  };
  const fallbackError = await evaluateModerationWithAi({
    summaryClient: failingClient,
    messageText: 'Message quelconque',
  });
  assert.equal(fallbackError.isViolation, true);
  assert.equal(fallbackError.fallback, true);
});
