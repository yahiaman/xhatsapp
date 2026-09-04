CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT UNIQUE NOT NULL,
  name TEXT,
  category TEXT NOT NULL DEFAULT 'unclassified',
  is_monitored BOOLEAN NOT NULL DEFAULT true,
  allow_auto_reply BOOLEAN NOT NULL DEFAULT false,
  allow_broadcast BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  chat_id TEXT NOT NULL REFERENCES whatsapp_groups(chat_id) ON UPDATE CASCADE,
  sender_id TEXT,
  sender_name TEXT,
  body TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  is_group BOOLEAN NOT NULL DEFAULT false,
  message_type TEXT NOT NULL DEFAULT 'unknown',
  received_at TIMESTAMPTZ NOT NULL,
  event_name TEXT NOT NULL DEFAULT 'message.received',
  idempotency_key TEXT,
  delivery_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'stored',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_idempotency_key_idx
  ON messages (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_chat_received_idx
  ON messages (chat_id, received_at DESC);

CREATE INDEX IF NOT EXISTS messages_received_idx
  ON messages (received_at DESC);

CREATE INDEX IF NOT EXISTS messages_processing_idx
  ON messages (processing_status, received_at DESC);
