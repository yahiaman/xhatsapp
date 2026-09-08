CREATE TABLE IF NOT EXISTS community_templates (
  id VARCHAR(64) PRIMARY KEY,
  content TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO community_templates (id, content, description)
VALUES 
  ('onboarding_dm', 'Assalāmu ‘alaykum wa rahmatullāhi wa barakātuh

chère sœur, cher frère,

Bienvenue au sein de la communauté Entraide Nusuk Hajj 1448 / 2027 🕋

Nous sommes heureux de vous accueillir dans cet espace créé pour permettre aux futurs pèlerins de s’informer, de s’entraider et d’avancer ensemble dans leurs démarches.

Afin que nos échanges restent utiles, respectueux et sereins, nous vous demandons simplement de respecter quelques règles essentielles :

🫥 Nous restons totalement neutres
Aucune recommandation, critique ou citation d’agence de voyage n’est autorisée dans les groupes.

📢 Aucune publicité ni collecte 

La vente de services, les cagnottes, les appels aux dons, les parrainages et les liens promotionnels ne sont pas acceptés.

🤍 Respect, fraternité et bienveillance
Chacun avance à son rythme. Les polémiques, les jugements et les informations non vérifiées n’ont pas leur place ici.

⏸️ Une pause pendant la nuit
Pour respecter le repos de chacun, les échanges sont suspendus tous les soirs de 23h00 à 9h00.

📝 Un récapitulatif chaque soir à 20h10, 
 nous partageons un résumé des informations importantes de la journée afin que personne ne manque l’essentiel.

📌Petit rappel : les mêmes informations sont diffusées dans tous nos groupes. Il est donc inutile d’en rejoindre plusieurs : votre présence dans un seul groupe suffit et permet de laisser une place aux autres futurs pèlerins.

Prenez le temps de lire les messages épinglés et n’hésitez pas à participer aux échanges lorsque le groupe est ouvert. L’équipe ENH reste présente, dans la mesure de ses possibilités, pour vous aider à mieux comprendre vos démarches.

Qu’Allah vous facilite chaque étape, mette la baraka dans votre préparation et vous accorde un Hajj accepté. 🤲🏻

L’équipe Entraide Nusuk Hajj 
Au service du Pèlerin 
Fi Sabilillah', 'Message de bienvenue envoyé en privé lors de l''intégration dans un groupe'),

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
