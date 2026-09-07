CREATE TABLE IF NOT EXISTS community_templates (
  id VARCHAR(64) PRIMARY KEY,
  content TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO community_templates (id, content, description)
VALUES 
  ('onboarding_dm', 'Assalamu alaykum wa rahmatullah chère sœur / cher frère,

Bienvenue dans la communauté d’entraide *Nusuk Hajj 1447 / 2026* 🕋 !

Afin de préserver la sérénité et l’utilité de nos échanges, voici les *règles d’or* à respecter :
1️⃣ *Neutralité absolue* : Aucune citation, recommandation ou critique d’agence de voyage n’est autorisée.
2️⃣ *Aucune publicité ni collecte* : Pas de vente de services, pas de liens de cagnottes, de dons ou de parrainage.
3️⃣ *Fraternité & Sérénité* : Respect strict entre pèlerins, aucune polémique ni propagation de rumeurs non vérifiées.
4️⃣ *Fermeture nocturne* : Les échanges sont automatiquement mis en pause chaque soir de 23h00 à 07h00.
5️⃣ *Récapitulatif quotidien* : Chaque soir à 20h10, un résumé complet des informations clés vous est partagé.

📌 *Rappel important* : Tous nos groupes partagent strictement les mêmes informations. Votre présence dans *un seul groupe* est largement suffisante et permet de laisser la place à d’autres pèlerins.

Qu’Allah facilite vos démarches et accepte votre pèlerinage ! 🤲', 'Message de bienvenue envoyé en privé lors de l''intégration dans un groupe'),

  ('duplicate_refusal_dm', 'Assalamu alaykum wa rahmatullah chère sœur / cher frère,

Vous venez de demander à rejoindre le groupe *{newGroupName}*, mais notre système a constaté que vous êtes déjà membre du groupe *{existingGroupName}*.

Afin de permettre au plus grand nombre de futurs pèlerins d’accéder aux échanges (les places étant limitées par WhatsApp) :
👉 *Votre demande pour ce second groupe a été automatiquement refusée.*

💡 *Rassurez-vous :* Tous nos groupes bénéficient rigoureusement des mêmes annonces, des mêmes alertes officielles et du même récapitulatif quotidien de 20h10. Vous ne manquez absolument rien en restant dans votre groupe actuel.

Merci pour votre fraternité, votre compréhension et votre solidarité entre pèlerins. 🤝
Qu’Allah bénisse et facilite votre Hajj ! 🤲', 'Message de refus envoyé en privé lorsqu''un membre déjà présent dans un groupe tente d''en rejoindre un autre')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'xhatsapp') THEN
    GRANT ALL PRIVILEGES ON TABLE community_templates TO xhatsapp;
  END IF;
END $$;
