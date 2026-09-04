CREATE TABLE IF NOT EXISTS moderation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL CHECK (code ~ '^[A-Z0-9]{6}$'),
  message_id UUID UNIQUE NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  source_group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE RESTRICT,
  categories TEXT[] NOT NULL,
  matched_terms TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ignored', 'deleted')),
  admin_alert_message_id TEXT,
  decision_message_id TEXT,
  decision_by_ref TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alerted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS moderation_alerts_status_created_idx
  ON moderation_alerts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_alerts_source_group_idx
  ON moderation_alerts (source_group_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_groups_one_enabled_admin_idx
  ON whatsapp_groups ((true))
  WHERE enabled = true AND is_admin = true;
