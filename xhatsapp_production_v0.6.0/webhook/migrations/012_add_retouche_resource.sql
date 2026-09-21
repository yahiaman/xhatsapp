INSERT INTO community_resources (id, title, url, description, keywords)
VALUES (
  'retouche',
  'Centre de Retouche Photo Nusuk Hajj',
  'https://www.entraidenuskhajj.fr/centre-de-retouche',
  'Outil officiel de recadrage et retouche photo aux normes pour valider votre photo de profil sur la plateforme Nusuk.',
  ARRAY['retouche', 'retouches', 'photo', 'photos', 'centre de retouche', 'retouche photo', 'recadrage', 'recadrer', 'dimension photo', 'norme photo', 'fond blanc']
)
ON CONFLICT (id) DO UPDATE SET
  url = EXCLUDED.url,
  updated_at = NOW();
