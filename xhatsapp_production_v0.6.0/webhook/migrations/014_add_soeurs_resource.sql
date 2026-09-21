INSERT INTO community_resources (id, title, url, description, keywords)
VALUES (
  'soeurs',
  'Groupe Telegram Réservé aux Sœurs',
  'https://t.me/+4GIehhQDBkRlZDA0',
  'Espace d’échange et d’entraide exclusivement réservé aux sœurs pour échanger, poser toutes vos questions et vous organiser entre futures pèlerines.',
  ARRAY['soeurs', 'soeur', 'sœurs', 'sœur', 'telegram soeurs', 'telegram soeur', 'groupe soeurs', 'groupe soeur', 'entraide soeurs', 'espace soeurs']
)
ON CONFLICT (id) DO UPDATE SET
  url = EXCLUDED.url,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  updated_at = NOW();
