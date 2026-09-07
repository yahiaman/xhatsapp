CREATE TABLE IF NOT EXISTS exempt_moderators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(64) NOT NULL UNIQUE,
  normalized_phone VARCHAR(64) NOT NULL,
  label VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exempt_moderators_phone ON exempt_moderators(normalized_phone);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'xhatsapp') THEN
    GRANT ALL PRIVILEGES ON TABLE exempt_moderators TO xhatsapp;
  END IF;
END $$;
