CREATE TABLE IF NOT EXISTS moderation_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(32) NOT NULL CHECK (category IN ('donation', 'advertising')),
  term VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_category_term UNIQUE (category, term)
);

CREATE INDEX IF NOT EXISTS idx_moderation_keywords_cat ON moderation_keywords(category);
