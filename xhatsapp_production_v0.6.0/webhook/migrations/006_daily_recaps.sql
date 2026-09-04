ALTER TABLE whatsapp_groups
  ADD COLUMN IF NOT EXISTS allow_recap BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS recap_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton = true),
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  run_time TIME NOT NULL DEFAULT '20:10',
  signature TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (char_length(signature) <= 600)
);

INSERT INTO recap_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS recap_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL CHECK (code ~ '^[A-Z0-9]{6}$'),
  local_date DATE UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'pending', 'publishing', 'published', 'partial_failed', 'cancelled', 'empty', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  decision_message_id TEXT,
  decision_by_ref TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS recap_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES recap_drafts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3500),
  message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  openwa_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  UNIQUE (draft_id, group_id)
);

CREATE INDEX IF NOT EXISTS recap_drafts_status_date_idx
  ON recap_drafts (status, local_date DESC);

CREATE INDEX IF NOT EXISTS recap_deliveries_draft_status_idx
  ON recap_deliveries (draft_id, status);

