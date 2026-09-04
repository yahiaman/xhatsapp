export function decideMessagePolicy(message, groupPolicy) {
  if (!message?.isGroup) {
    return { allowed: false, reason: 'private_chat' };
  }

  if (!groupPolicy?.enabled) {
    return { allowed: false, reason: 'chat_not_allowed' };
  }

  const acceptsIncoming = groupPolicy.is_monitored
    || groupPolicy.is_admin
    || groupPolicy.is_test;

  if (!acceptsIncoming) {
    return { allowed: false, reason: 'chat_not_allowed' };
  }

  return { allowed: true, reason: null };
}
