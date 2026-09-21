INSERT INTO community_resources (id, title, url, description, keywords, updated_at)
VALUES
  (
    'serie',
    'Série Vidéos Nusuk Hajj',
    'https://www.youtube.com/playlist?list=PL0Ge8X64kTmb0MR92X-5ZPfy_CT4aFDsg',
    'Playlist YouTube officielle : Série complète de vidéos explicatives pour tout comprendre et préparer sereinement votre Hajj.',
    ARRAY['serie', 'série', 'series', 'séries', 'playlist serie', 'videos serie', 'serie youtube'],
    now()
  ),
  (
    'podcast',
    'Podcasts Nusuk Hajj',
    'https://www.youtube.com/playlist?list=PL0Ge8X64kTmZTaxeV87jJ7hMg-wezmMR2',
    'Playlist YouTube officielle : Retrouvez l’ensemble des podcasts et émissions audio/vidéo Entraide Nusuk Hajj.',
    ARRAY['podcast', 'podcasts', 'emission', 'emissions', 'audio', 'ecouter', 'podcast nusuk'],
    now()
  ),
  (
    'tuto',
    'Tutoriels Vidéos Nusuk Hajj',
    'https://www.youtube.com/playlist?list=PLGwB4htJ5qOU',
    'Playlist YouTube officielle : Tutoriels pratiques et démonstrations pas-à-pas pour toutes vos démarches sur Nusuk.',
    ARRAY['tuto', 'tutos', 'tutoriel', 'tutoriels', 'demarche', 'guide video', 'tutoriel video'],
    now()
  ),
  (
    'live',
    'Rediffusions des Lives Nusuk Hajj',
    'https://www.youtube.com/playlist?list=PLVVFIfeQyKQY',
    'Playlist YouTube officielle : Rediffusions complètes de tous nos lives de questions/réponses en direct.',
    ARRAY['live', 'lives', 'rediffusion', 'rediffusions', 'direct', 'directs', 'replay', 'replays'],
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  updated_at = now();

UPDATE community_resources
SET keywords = ARRAY['youtube', 'chaine youtube', 'chaine', 'video', 'videos']
WHERE id = 'youtube';
