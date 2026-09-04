const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseSchedule(value) {
  if (!value || typeof value !== 'object') return null;
  const enabled = value.enabled;
  const timezone = String(value.timezone || '').trim();
  const weekdays = Array.isArray(value.weekdays)
    ? [...new Set(value.weekdays.map(Number))].sort((a, b) => a - b)
    : [];
  const openTime = String(value.openTime || '').trim();
  const closeTime = String(value.closeTime || '').trim();
  const openMessage = String(value.openMessage || '').trim();
  const closeMessage = String(value.closeMessage || '').trim();
  if (typeof enabled !== 'boolean'
    || !isValidTimezone(timezone)
    || weekdays.length < 1
    || weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
    || !TIME_PATTERN.test(openTime)
    || !TIME_PATTERN.test(closeTime)
    || openTime >= closeTime
    || openMessage.length < 1 || openMessage.length > 3500
    || closeMessage.length < 1 || closeMessage.length > 3500) return null;
  if (enabled && value.confirm !== true) return { confirmationRequired: true };
  return { enabled, timezone, weekdays, openTime, closeTime, openMessage, closeMessage };
}

export function localClock(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[values.weekday];
  return {
    localDate: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    weekday,
  };
}

export function dueAction(schedule, date = new Date()) {
  if (!schedule.enabled) return null;
  const clock = localClock(date, schedule.timezone);
  if (!schedule.weekdays.includes(clock.weekday)) return null;
  if (clock.time >= schedule.closeTime) return { action: 'close', ...clock };
  if (clock.time >= schedule.openTime) return { action: 'open', ...clock };
  return null;
}

export function readAnnounce(settings) {
  const candidates = [settings?.announce, settings?.settings?.announce, settings?.data?.announce];
  return candidates.find((value) => typeof value === 'boolean');
}
