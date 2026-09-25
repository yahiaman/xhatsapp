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

test('extracts media details when present in incoming message payload', () => {
  const result = extractMessage({
    event: 'message.received',
    data: {
      id: 'false_120363000000000000@g.us_IMG',
      chatId: '120363000000000000@g.us',
      caption: 'COMMUNICATION\nAnnonce photo',
      type: 'image',
      media: {
        mimetype: 'image/jpeg',
        data: 'aW1hZ2VkYXRh',
        filename: 'annonce.jpg',
      },
      timestamp: 1782931017,
      isGroup: true,
    },
  });

  assert.equal(result.messageType, 'image');
  assert.equal(result.text, 'COMMUNICATION\nAnnonce photo');
  assert.ok(result.media);
  assert.equal(result.media.type, 'image');
  assert.equal(result.media.mimetype, 'image/jpeg');
  assert.equal(result.media.data, 'aW1hZ2VkYXRh');
  assert.equal(result.media.filename, 'annonce.jpg');
  assert.equal(result.media.omitted, false);
});

test('marks media as omitted when data is absent in image message', () => {
  const result = extractMessage({
    event: 'message.received',
    data: {
      id: 'false_120363000000000000@g.us_IMG_OMITTED',
      chatId: '120363000000000000@g.us',
      caption: 'FLASH',
      type: 'image',
      timestamp: 1782931017,
      isGroup: true,
    },
  });

  assert.equal(result.messageType, 'image');
  assert.ok(result.media);
  assert.equal(result.media.type, 'image');
  assert.equal(result.media.omitted, true);
  assert.equal(result.media.data, null);
});

