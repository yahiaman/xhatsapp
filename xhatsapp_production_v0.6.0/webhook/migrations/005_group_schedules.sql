CREATE TABLE IF NOT EXISTS group_schedules (
  group_id UUID PRIMARY KEY REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  weekdays SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7]::SMALLINT[],
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '22:00',
  open_message TEXT NOT NULL DEFAULT 'Bonjour, le groupe est maintenant ouvert aux échanges.',
  close_message TEXT NOT NULL DEFAULT 'Le groupe ferme maintenant. Merci pour vos échanges.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (open_time < close_time),
  CHECK (cardinality(weekdays) BETWEEN 1 AND 7),
  CHECK (weekdays <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]),
  CHECK (char_length(open_message) BETWEEN 1 AND 3500),
  CHECK (char_length(close_message) BETWEEN 1 AND 3500)
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('open', 'close')),
  local_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'partial_failed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  message_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (message_status IN ('pending', 'sent', 'failed', 'skipped')),
  settings_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (settings_status IN ('pending', 'verified', 'failed')),
  openwa_message_id TEXT,
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, action, local_date)
);

CREATE INDEX IF NOT EXISTS schedule_runs_status_idx
  ON schedule_runs (status, updated_at);
