import assert from 'node:assert/strict';
import test from 'node:test';
import { extractMessage } from '../src/message.js';

test('normalizes the OpenWA message envelope observed in production', () => {
  const result = extractMessage({
    event: 'message.received',
    data: {
      id: 'false_120363000000000000@g.us_ABC',
      from: '120363000000000000@g.us',
      chatId: '120363000000000000@g.us',
      body: 'Bonjour',
      type: 'text',
      timestamp: 1782931017,
      fromMe: false,
      isGroup: true,
      author: '39370000000000@lid',
      contact: { pushName: 'Membre' },
    },
  });

  assert.equal(result.messageId, 'false_120363000000000000@g.us_ABC');
  assert.equal(result.chatId, '120363000000000000@g.us');
  assert.equal(result.senderId, '39370000000000@lid');
  assert.equal(result.senderName, 'Membre');
  assert.equal(result.text, 'Bonjour');
  assert.equal(result.isGroup, true);
  assert.equal(result.fromMe, false);
});

test('creates a stable synthetic id when OpenWA omits the message id', () => {
  const payload = { data: { chatId: 'group@g.us', body: 'Test', timestamp: 1782931017 } };
  assert.equal(extractMessage(payload).messageId, extractMessage(payload).messageId);
});
