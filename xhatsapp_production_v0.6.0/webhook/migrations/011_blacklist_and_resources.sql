CREATE TABLE IF NOT EXISTS banned_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(64) NOT NULL UNIQUE,
  normalized_phone VARCHAR(64) NOT NULL,
  reason TEXT,
  banned_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banned_members_phone ON banned_members(normalized_phone);

CREATE TABLE IF NOT EXISTS community_resources (
  id VARCHAR(32) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO community_resources (id, title, url, description, keywords)
VALUES
  (
    'youtube',
    'Chaîne YouTube Entraide Nusuk Hajj',
    'https://www.youtube.com/@entraidenusukhajj',
    'Retrouvez tous nos guides vidéos, tutoriels pas-à-pas et rediffusions pour bien préparer votre Hajj sur la plateforme Nusuk.',
    ARRAY['youtube', 'chaine youtube', 'chaine', 'video', 'videos', 'tutoriel', 'tuto', 'tutos']
  ),
  (
    'site',
    'Site Web Officiel Entraide Nusuk Hajj',
    'https://entraide-nusuk-hajj.com',
    'Consultez nos articles complets, les actualités en direct et les fiches pratiques pour vos démarches.',
    ARRAY['site', 'site internet', 'site web', 'notre site', 'le site', 'article', 'articles', 'portail']
  ),
  (
    'faq',
    'Foire Aux Questions (FAQ) Nusuk Hajj',
    'https://entraide-nusuk-hajj.com/faq',
    'Toutes les réponses aux questions les plus posées par les futurs pèlerins : démarches, paiements, statuts.',
    ARRAY['faq', 'foire aux questions', 'questions frequentes', 'reponses aux questions']
  ),
  (
    'hotels',
    'Cartes & Localisation des Hôtels',
    'https://entraide-nusuk-hajj.com/hotels',
    'Cartes interactives des hôtels à La Mecque et Médine avec distances Masjid al-Haram et Masjid an-Nabawi.',
    ARRAY['hotel', 'hotels', 'carte', 'cartes', 'carte des hotels', 'cartes des hotels', 'distance', 'localisation', 'geolocalisation']
  ),
  (
    'packages',
    'Guide des Packages & Offres Nusuk',
    'https://entraide-nusuk-hajj.com/packages',
    'Comparatif et conseils pour analyser les packages, les prestations incluses et choisir l''offre la plus adaptée.',
    ARRAY['package', 'packages', 'offres', 'forfait', 'forfaits', 'tarifs', 'comparatif']
  )
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'xhatsapp') THEN
    GRANT ALL PRIVILEGES ON TABLE banned_members TO xhatsapp;
    GRANT ALL PRIVILEGES ON TABLE community_resources TO xhatsapp;
  END IF;
END $$;
