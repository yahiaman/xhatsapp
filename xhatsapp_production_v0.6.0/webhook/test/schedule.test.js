import assert from 'node:assert/strict';
import test from 'node:test';
import { dueAction, parseSchedule, readAnnounce } from '../src/schedule.js';
import { executeScheduledAction, verifySchedulePermission } from '../src/scheduler.js';

const valid = {
  enabled: true, timezone: 'Europe/Paris', weekdays: [1, 2, 3, 4, 5],
  openTime: '08:00', closeTime: '22:00', openMessage: 'Ouverture',
  closeMessage: 'Fermeture', confirm: true,
};

test('validates a confirmed same-day schedule', () => {
  assert.deepEqual(parseSchedule(valid), {
    enabled: true, timezone: 'Europe/Paris', weekdays: [1, 2, 3, 4, 5],
    openTime: '08:00', closeTime: '22:00', openMessage: 'Ouverture', closeMessage: 'Fermeture',
  });
  assert.equal(parseSchedule({ ...valid, confirm: false }).confirmationRequired, true);
  assert.equal(parseSchedule({ ...valid, openTime: '23:00' }), null);
});

test('selects only the latest due action in Europe/Paris', () => {
  const schedule = parseSchedule(valid);
  assert.equal(dueAction(schedule, new Date('2026-09-02T07:00:00Z')).action, 'open');
  assert.equal(dueAction(schedule, new Date('2026-09-02T21:00:00Z')).action, 'close');
});

test('reads supported OpenWA group settings envelopes', () => {
  assert.equal(readAnnounce({ announce: true }), true);
  assert.equal(readAnnounce({ data: { announce: false } }), false);
});

test('closes after sending and opens before sending', async () => {
  const closeCalls = [];
  const closeWa = {
    sendText: async () => { closeCalls.push('message'); return { id: 'm1' }; },
    updateGroupSettings: async (_id, body) => closeCalls.push(`settings:${body.announce}`),
    getGroupSettings: async () => ({ announce: true }),
  };
  const closed = await executeScheduledAction({ action: 'close', chatId: 'g', message: 'x', openWa: closeWa, errorLabel: () => 'error' });
  assert.deepEqual(closeCalls, ['message', 'settings:true']);
  assert.equal(closed.status, 'completed');

  const openCalls = [];
  const openWa = {
    sendText: async () => { openCalls.push('message'); return { id: 'm2' }; },
    updateGroupSettings: async (_id, body) => openCalls.push(`settings:${body.announce}`),
    getGroupSettings: async () => ({ settings: { announce: false } }),
  };
  const opened = await executeScheduledAction({ action: 'open', chatId: 'g', message: 'x', openWa: openWa, errorLabel: () => 'error' });
  assert.deepEqual(openCalls, ['settings:false', 'message']);
  assert.equal(opened.status, 'completed');
});

test('permission check writes back the unchanged setting', async () => {
  let written;
  const openWa = {
    getGroupSettings: async () => ({ announce: true }),
    updateGroupSettings: async (_id, body) => { written = body; },
  };
  await verifySchedulePermission(openWa, 'g');
  assert.deepEqual(written, { announce: true });
});

test('a retry does not resend an already delivered closing message', async () => {
  const calls = [];
  const openWa = {
    sendText: async () => { calls.push('message'); },
    updateGroupSettings: async () => calls.push('settings'),
    getGroupSettings: async () => ({ announce: true }),
  };
  const result = await executeScheduledAction({
    action: 'close', chatId: 'g', message: 'x', openWa,
    errorLabel: () => 'error',
    previous: { messageStatus: 'sent', settingsStatus: 'failed', openWaMessageId: 'm1' },
  });
  assert.deepEqual(calls, ['settings']);
  assert.equal(result.status, 'completed');
  assert.equal(result.openWaMessageId, 'm1');
});

test('waits for OpenWA eventual consistency before confirming a change', async () => {
  let reads = 0;
  const openWa = {
    verificationDelayMs: 0,
    updateGroupSettings: async () => {},
    getGroupSettings: async () => ({ announce: ++reads >= 3 ? false : true }),
    sendText: async () => ({ id: 'm3' }),
  };
  const result = await executeScheduledAction({
    action: 'open', chatId: 'g', message: 'x', openWa, errorLabel: () => 'error',
  });
  assert.equal(reads, 3);
  assert.equal(result.status, 'completed');
});
