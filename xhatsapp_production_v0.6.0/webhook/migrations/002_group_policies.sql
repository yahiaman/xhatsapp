ALTER TABLE whatsapp_groups
  ALTER COLUMN is_monitored SET DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_groups'
      AND column_name = 'enabled'
  ) THEN
    ALTER TABLE whatsapp_groups
      ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN inventory_ref TEXT,
      ADD COLUMN last_seen_at TIMESTAMPTZ;

    UPDATE whatsapp_groups
    SET is_monitored = false,
        allow_auto_reply = false,
        allow_broadcast = false;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_groups_inventory_ref_idx
  ON whatsapp_groups (inventory_ref)
  WHERE inventory_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS group_policy_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT 'admin-console',
  previous_policy JSONB NOT NULL,
  new_policy JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_policy_audit_changed_idx
  ON group_policy_audit (changed_at DESC);
