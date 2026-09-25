ALTER TABLE broadcast_drafts
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_mimetype TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_data TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_filename TEXT DEFAULT NULL;

ALTER TABLE broadcast_drafts DROP CONSTRAINT IF EXISTS broadcast_drafts_body_check;
ALTER TABLE broadcast_drafts ADD CONSTRAINT broadcast_drafts_body_check
  CHECK (char_length(body) <= 3500 AND (char_length(body) >= 1 OR media_data IS NOT NULL));
