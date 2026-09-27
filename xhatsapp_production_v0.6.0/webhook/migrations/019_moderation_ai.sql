-- Migration 019: Support de l'arbitrage IA et apprentissage de modération
ALTER TABLE moderation_alerts
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

CREATE INDEX IF NOT EXISTS moderation_alerts_status_decided_idx
  ON moderation_alerts (status, decided_at DESC NULLS LAST);
