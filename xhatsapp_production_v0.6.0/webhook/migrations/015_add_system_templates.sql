INSERT INTO community_templates (id, content, description, updated_at)
VALUES 
  (
    'group_open_message',
    'Les groupes sont désormais ouverts ! 🌸

Vous pouvez dès maintenant reprendre vos échanges, poser vos questions et partager vos conseils dans la bienveillance et le respect de chacun.

Allah ﷻ dit :

« Entraidez-vous dans l’accomplissement des bonnes œuvres et de la piété. »
Sourate Al-Mâ’ida, verset 2

N’hésitez pas à vous entraider, une réponse, un conseil ou un simple retour d’expérience peut être précieux pour un autre futur pèlerin  🌸

Nous sommes heureux de vous retrouver et vous souhaitons de beaux échanges à tous 🤲🏻

Entraide Nusuk Hajj
Au service du pèlerin',
    'Message automatique diffusé dans tous les groupes surveillés lors de l''ouverture matinale',
    now()
  ),
  (
    'group_close_message',
    '🌙 Les groupes watsapp ferment leurs portes pour ce soir.🌸

Merci à tous pour vos échanges, votre bienveillance et votre entraide tout au long de la journée.

Gardons à l’esprit que chaque chose arrive au moment qu’Allah a décrété. Faisons preuve de patience, avançons étape par étape et plaçons pleinement notre confiance en Lui. Le tawakkul, c’est faire les causes tout en ayant la certitude qu’Allah est le Meilleur des planificateurs 🤲🏻

📲 Notre groupe d’échange Telegram reste ouvert et prend le relais. Vous pouvez donc continuer à y poser vos questions et à échanger dans le respect et la bienveillance.

Les groupes watsapp rouvriront demain matin, bi idhnillāh. D’ici là, prenez soin de vous et de vos intentions

Entraide Nusuk Hajj
Au service du pèlerin',
    'Message automatique diffusé dans tous les groupes surveillés lors de la fermeture nocturne',
    now()
  ),
  (
    'agency_citation_warning',
    '🚨 Petit rappel : merci de ne pas citer de noms d’agences dans le groupe.

Entraide Nusuk Hajj tient à rester totalement neutre à ce sujet. Cette règle permet d’éviter toute publicité, recommandation ou critique, mais aussi de préserver notre communauté de toute tentative de démarchage commercial.

Notre groupe est avant tout un espace d’entraide et d’information. Merci à tous pour votre compréhension et pour le respect de cette règle 🤲🏻

L’équipe Entraide Nusuk 
Au service du pèlerin',
    'Message de rappel envoyé dans le groupe lorsqu''une agence interdite est citée',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  description = EXCLUDED.description,
  updated_at = EXCLUDED.updated_at;
