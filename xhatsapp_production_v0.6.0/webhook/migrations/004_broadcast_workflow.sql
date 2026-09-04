CREATE TABLE IF NOT EXISTS broadcast_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL CHECK (code ~ '^[A-Z0-9]{6}$'),
  source_message_id UUID UNIQUE NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
  admin_group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 3500),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'publishing', 'published', 'partial_failed', 'cancelled')),
  created_by_ref TEXT,
  decision_message_id TEXT,
  decision_by_ref TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES broadcast_drafts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE RESTRICT,
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

CREATE INDEX IF NOT EXISTS broadcast_drafts_status_created_idx
  ON broadcast_drafts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS broadcast_deliveries_draft_status_idx
  ON broadcast_deliveries (draft_id, status);
