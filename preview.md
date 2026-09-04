# Cahier des charges — Xhatsapp

## 1. Contexte du projet

Le projet **Xhatsapp** vise à mettre en place un système automatisé de gestion, modération, diffusion et synthèse pour plusieurs groupes WhatsApp liés à des activités Hajj / Omra / bénévoles / administration.

L’objectif n’est pas uniquement de créer un chatbot de réponse automatique, mais plutôt un **centre de pilotage WhatsApp multi-groupes**, capable de :

- surveiller plusieurs groupes WhatsApp ;
- détecter des messages sensibles ou suspects ;
- transférer les alertes vers un groupe admin ;
- permettre la validation humaine avant publication ;
- publier des communications sur plusieurs groupes ;
- planifier des messages d’ouverture et de fermeture ;
- extraire les discussions ;
- générer des récapitulatifs quotidiens ;
- utiliser une IA locale ou cloud selon le besoin.

Le système doit fonctionner principalement dans Docker, sur une VM Azure, et rester évolutif.

---

## 2. Objectifs fonctionnels

### 2.1. Gestion multi-groupes WhatsApp

Le système doit pouvoir gérer plusieurs groupes WhatsApp, par exemple :

- groupes Hajj ;
- groupes Omra ;
- groupes bénévoles ;
- groupe administrateurs ;
- groupes de test.

Chaque groupe doit pouvoir avoir une configuration spécifique :

- groupe surveillé ou non ;
- groupe autorisé à recevoir des réponses automatiques ou non ;
- groupe destinataire des broadcasts ou non ;
- catégorie du groupe : `hajj`, `omra`, `benevoles`, `admins`, `test`, etc. ;
- horaires d’ouverture / fermeture ;
- messages programmés spécifiques.

---

## 3. Fonctionnalités attendues

## 3.1. Surveillance et archivage des messages

Le système doit enregistrer tous les messages entrants des groupes surveillés.

Données à stocker :

- identifiant du message ;
- identifiant du groupe WhatsApp ;
- nom du groupe si disponible ;
- identifiant de l’expéditeur ;
- nom affiché de l’expéditeur si disponible ;
- contenu texte du message ;
- date et heure de réception ;
- type de message ;
- indicateur `fromMe` ;
- statut de traitement ;
- catégories détectées ;
- éventuel score de suspicion.

Objectifs :

- permettre un historique complet ;
- générer des récapitulatifs ;
- identifier les sujets récurrents ;
- retrouver les messages suspects ;
- produire des statistiques par groupe.

---

## 3.2. Détection automatique des messages suspects

Le système doit détecter automatiquement les messages pouvant concerner :

- agences concurrentes ;
- publicité pour une agence ;
- demande de don ;
- cagnotte ;
- collecte d’argent ;
- demande de virement ;
- RIB / IBAN ;
- PayPal ;
- Western Union / MoneyGram ;
- sollicitation en message privé ;
- promotion Hajj / Omra ;
- démarchage commercial ;
- liens suspects.

### Exemple de mots-clés initiaux

```txt
agence
agence agréée
omra pas cher
hajj pas cher
inscription omra
inscription hajj
promo omra
promo hajj
collecte
cagnotte
don
dons
faire un don
envoyez vos dons
rib
iban
paypal
western union
moneygram
contactez-moi en privé
contactez moi en privé
message privé
dm
```

La première version peut fonctionner par mots-clés et scoring.

Une version ultérieure peut utiliser un LLM pour classifier les cas ambigus.

---

## 3.3. Transfert des alertes vers le groupe admin

Quand un message suspect est détecté, le bot doit transférer une alerte dans le groupe admin.

### Format attendu de l’alerte

```txt
🚨 Message suspect détecté

Groupe : [Nom du groupe]
Chat ID : [ID du groupe]
Auteur : [Nom / ID]
Motif : [mots-clés détectés]
Score : [score éventuel]

Message :
"[contenu du message]"

Action recommandée :
Vérifier le message et décider s’il doit être supprimé.
```

Le système ne doit pas supprimer automatiquement les messages en V1.

La suppression peut être ajoutée plus tard avec une commande admin si l’API OpenWA le permet.

---

## 3.4. Groupe admin comme centre de validation

Le groupe admin doit servir à :

- recevoir les alertes ;
- valider les messages de communication ;
- déclencher des broadcasts ;
- recevoir les récapitulatifs ;
- piloter certaines commandes du bot.

---

## 3.5. Workflow de publication multi-groupes

Les admins doivent pouvoir préparer une communication dans le groupe admin, puis la publier dans plusieurs groupes après validation.

### Commande de brouillon

Exemples :

```txt
#broadcast all
Message à publier ici
```

```txt
#broadcast omra
Message à publier ici
```

```txt
#broadcast hajj
Message à publier ici
```

```txt
#broadcast test
Message à publier ici
```

Le bot doit répondre dans le groupe admin :

```txt
📣 Brouillon détecté

Cible : omra
Nombre de groupes concernés : 3

Répondez :
OK PUBLIER
ou
ANNULER
```

### Validation

Si un admin répond :

```txt
OK PUBLIER
```

Le bot publie le message dans les groupes ciblés.

### Annulation

Si un admin répond :

```txt
ANNULER
```

Le bot annule la publication.

### Confirmation après publication

```txt
✅ Message publié dans 3 groupes.
```

---

## 3.6. Messages programmés d’ouverture et de fermeture

Le système doit pouvoir envoyer automatiquement des messages d’ouverture et de fermeture dans certains groupes.

### Exemple d’ouverture

```txt
Assalāmu ʿalaykum wa raḥmatullāh,

Le groupe est ouvert pour vos questions aujourd’hui.
Merci de poser vos questions clairement, une à la fois.
L’équipe vous répondra dès que possible in shā Allāh.
```

### Exemple de fermeture

```txt
Assalāmu ʿalaykum,

Le groupe est fermé pour ce soir.
Merci de patienter jusqu’à demain matin pour les questions non urgentes.
En cas d’urgence réelle, contactez directement un responsable.
Bārak Allāhu fīkum.
```

### Configuration souhaitée

```env
OPENING_MESSAGE_ENABLED=true
OPENING_MESSAGE_TIME=08:00

CLOSING_MESSAGE_ENABLED=true
CLOSING_MESSAGE_TIME=22:00

DEFAULT_TIMEZONE=Europe/Paris
```

V1 : simple message informatif.

V2 : si OpenWA le permet, modification des permissions du groupe pour passer en mode “admins only” à la fermeture et rouvrir le matin.

---

## 3.7. Récapitulatif quotidien des échanges

Chaque matin, le système doit générer un récapitulatif des échanges de tous les groupes surveillés.

### Objectif

Produire un point de situation envoyé au groupe admin.

### Exemple de récapitulatif

```txt
📌 Point de situation — 18 août 2026

Groupe Omra 1 :
- 8 questions sur les bagages
- 3 questions sur Rawdah
- 2 demandes d’horaires
- 1 message suspect détecté concernant une collecte

Groupe Hajj :
- Plusieurs questions sur le départ
- Une personne n’a pas trouvé son badge
- Aucun message suspect détecté

Actions recommandées :
1. Republier le rappel bagages.
2. Confirmer les horaires de bus.
3. Vérifier le message suspect signalé hier soir.
```

### Configuration souhaitée

```env
DAILY_SUMMARY_ENABLED=true
DAILY_SUMMARY_TIME=07:30
ADMIN_CHAT_ID=120363XXXXXXXX@g.us
```

---

## 3.8. Message du matin

Après le récapitulatif, le système doit pouvoir générer ou envoyer un message du matin dans les groupes ciblés.

### Exemple

```txt
Assalāmu ʿalaykum wa raḥmatullāh,

Suite aux questions revenues hier, voici les rappels importants :
- Merci de bien identifier vos bagages.
- Les horaires officiels seront confirmés uniquement par l’équipe.
- Pour Rawdah, attendez la confirmation des responsables.

Qu’Allāh vous facilite.
```

Le message peut être :

- fixe ;
- personnalisé par groupe ;
- généré par IA à partir du récapitulatif.

---

## 3.9. Réponse automatique limitée

La réponse automatique déjà testée doit rester optionnelle et limitée.

Elle doit fonctionner uniquement :

- dans les groupes autorisés ;
- sur certains mots-clés ;
- avec anti-spam ;
- en ignorant les messages du bot ;
- sans inventer d’informations sensibles.

### Exemples de sujets autorisés

- bagages ;
- Rawdah ;
- hôtels ;
- horaires ;
- visa ;
- passeport ;
- bus ;
- départ ;
- Omra / Hajj.

La réponse automatique ne doit pas remplacer les admins sur les sujets sensibles.

---

# 4. Architecture technique cible

## 4.1. Composants principaux

| Composant | Rôle |
|---|---|
| OpenWA officiel | Gateway WhatsApp, API, dashboard, sessions |
| Webhook Node.js | Logique métier, réception des événements, analyse, publication |
| Ollama | IA locale de secours / tâches simples |
| Token Router / OmniRoute | IA cloud ou routage LLM pour résumés complexes |
| PostgreSQL | Stockage des messages, groupes, brouillons, alertes, historiques |
| Redis / BullMQ | Jobs programmés, files d’attente, anti-spam, retries |
| Caddy | HTTPS / reverse proxy |
| Docker Compose | Orchestration des services |

---

## 4.2. Flux principal

```txt
Message WhatsApp
→ OpenWA
→ Webhook Node.js
→ Stockage PostgreSQL
→ Analyse mots-clés / IA
→ Alerte admin si nécessaire
→ Réponse ou action programmée si nécessaire
```

---

## 4.3. Flux de publication admin

```txt
Admin publie un brouillon dans le groupe admin
→ Bot détecte #broadcast
→ Bot crée un brouillon pending
→ Admin répond OK PUBLIER
→ Bot publie dans les groupes ciblés
→ Bot confirme dans le groupe admin
```

---

## 4.4. Flux de récapitulatif quotidien

```txt
Scheduler 07:30
→ Récupère les messages des dernières 24h
→ Groupe les messages par chat
→ Génère un résumé avec IA
→ Envoie le résumé au groupe admin
→ Génère éventuellement un message du matin
→ Envoie le message du matin aux groupes ciblés
```

---

# 5. IA : stratégie recommandée

La VM Azure ne disposant pas de GPU, il est recommandé d’utiliser une stratégie hybride.

## 5.1. IA locale

Usage :

- fallback ;
- petits résumés ;
- réponses simples ;
- tests ;
- confidentialité maximale.

Modèles possibles :

```env
OLLAMA_MODEL=llama3.2:3b
```

ou :

```env
OLLAMA_MODEL=gemma4:12b
```

À noter : sans GPU, les modèles lourds peuvent être lents.

## 5.2. IA cloud via Token Router / OmniRoute

Usage recommandé :

- récapitulatif quotidien ;
- rédaction du message du matin ;
- classification complexe de messages suspects ;
- reformulation des communications ;
- fallback intelligent.

Configuration envisagée :

```env
AI_PROVIDER=hybrid

OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b

TOKEN_ROUTER_ENABLED=true
TOKEN_ROUTER_BASE_URL=https://beta.token-router.org/v1
TOKEN_ROUTER_API_KEY=xxxxxxxx
TOKEN_ROUTER_MODEL=auto

OMNIROUTE_ENABLED=false
OMNIROUTE_BASE_URL=http://host.docker.internal:20128/v1
OMNIROUTE_API_KEY=xxxxxxxx
OMNIROUTE_MODEL=auto
```

---

# 6. Configuration `.env` cible

```env
DOMAIN=bot.entraidenusukhajj.fr

WEBHOOK_TOKEN=xxxxxxxx

OPENWA_URL=http://openwa-api:2785/api
OPENWA_API_KEY=xxxxxxxx
OPENWA_SESSION_ID=xxxxxxxx

ADMIN_CHAT_ID=120363XXXXXXXX@g.us

MONITORED_CHAT_IDS=120363244471876003@g.us,120363YYYYYYYYYYYY@g.us
ALLOWED_AUTO_REPLY_CHAT_IDS=120363244471876003@g.us

BROADCAST_HAJJ_CHAT_IDS=120363AAA@g.us,120363BBB@g.us
BROADCAST_OMRA_CHAT_IDS=120363CCC@g.us,120363DDD@g.us
BROADCAST_ALL_CHAT_IDS=120363AAA@g.us,120363BBB@g.us,120363CCC@g.us

OPENING_MESSAGE_ENABLED=true
OPENING_MESSAGE_TIME=08:00

CLOSING_MESSAGE_ENABLED=true
CLOSING_MESSAGE_TIME=22:00

DAILY_SUMMARY_ENABLED=true
DAILY_SUMMARY_TIME=07:30

MORNING_MESSAGE_ENABLED=true
MORNING_MESSAGE_TIME=08:00

DEFAULT_TIMEZONE=Europe/Paris

CHAT_COOLDOWN_MS=30000

OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b

AI_PROVIDER=hybrid
TOKEN_ROUTER_ENABLED=true
TOKEN_ROUTER_BASE_URL=https://beta.token-router.org/v1
TOKEN_ROUTER_API_KEY=xxxxxxxx
TOKEN_ROUTER_MODEL=auto

OMNIROUTE_ENABLED=false
OMNIROUTE_BASE_URL=http://host.docker.internal:20128/v1
OMNIROUTE_API_KEY=xxxxxxxx
OMNIROUTE_MODEL=auto
```

---

# 7. Base de données PostgreSQL

## 7.1. Table `whatsapp_groups`

Objectif : stocker les groupes connus.

Champs :

```sql
id UUID PRIMARY KEY
chat_id TEXT UNIQUE NOT NULL
name TEXT
category TEXT
is_monitored BOOLEAN DEFAULT true
allow_auto_reply BOOLEAN DEFAULT false
allow_broadcast BOOLEAN DEFAULT true
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 7.2. Table `messages`

Objectif : stocker les messages entrants et sortants.

```sql
id UUID PRIMARY KEY
message_id TEXT
chat_id TEXT NOT NULL
chat_name TEXT
sender_id TEXT
sender_name TEXT
text TEXT
from_me BOOLEAN DEFAULT false
message_type TEXT
received_at TIMESTAMP
created_at TIMESTAMP
```

---

## 7.3. Table `suspicious_alerts`

Objectif : historiser les alertes.

```sql
id UUID PRIMARY KEY
message_id TEXT
chat_id TEXT
sender_id TEXT
sender_name TEXT
text TEXT
keywords TEXT[]
score INTEGER
status TEXT DEFAULT 'pending'
admin_message_id TEXT
created_at TIMESTAMP
resolved_at TIMESTAMP
```

Statuts possibles :

```txt
pending
ignored
to_delete
deleted
false_positive
```

---

## 7.4. Table `broadcasts`

Objectif : stocker les brouillons et publications.

```sql
id UUID PRIMARY KEY
source_admin_chat_id TEXT
created_by TEXT
target TEXT
message TEXT
status TEXT DEFAULT 'pending'
created_at TIMESTAMP
validated_at TIMESTAMP
sent_at TIMESTAMP
```

Statuts possibles :

```txt
pending
cancelled
validated
sent
failed
```

---

## 7.5. Table `scheduled_messages`

Objectif : stocker les messages programmés.

```sql
id UUID PRIMARY KEY
name TEXT
chat_ids TEXT[]
message TEXT
cron_expression TEXT
timezone TEXT
is_active BOOLEAN DEFAULT true
last_sent_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## 7.6. Table `daily_summaries`

Objectif : stocker les récapitulatifs.

```sql
id UUID PRIMARY KEY
summary_date DATE
period_start TIMESTAMP
period_end TIMESTAMP
summary_text TEXT
admin_chat_id TEXT
sent_message_id TEXT
created_at TIMESTAMP
```

---

# 8. Règles de sécurité

## 8.1. Sécurité API

- OpenWA doit rester accessible uniquement en interne Docker ou via tunnel SSH.
- Le dashboard OpenWA ne doit pas être exposé publiquement sans protection.
- Le webhook public doit être derrière Caddy en HTTPS.
- Les endpoints sensibles doivent être protégés par `WEBHOOK_TOKEN`.
- Les clés API ne doivent jamais être commitées dans Git.

## 8.2. Données personnelles

- Éviter de stocker inutilement les numéros en clair si possible.
- Prévoir une anonymisation dans les logs techniques.
- Limiter l’accès aux récapitulatifs au groupe admin.
- Ne pas envoyer automatiquement des données sensibles à une IA cloud sans décision claire.

## 8.3. Modération

- Ne pas supprimer automatiquement les messages en V1.
- Toujours transférer les cas suspects au groupe admin.
- Ajouter suppression par validation humaine en V2.

---

# 9. Étapes de développement recommandées

## Phase 1 — Stabilisation existante

- OpenWA officiel fonctionnel.
- Webhook Node.js fonctionnel.
- Réponse WhatsApp testée.
- Groupe autorisé configuré.
- Anti-boucle et anti-spam en place.

État : déjà en grande partie réalisé.

---

## Phase 2 — Base de données et stockage

Objectifs :

- ajouter PostgreSQL ;
- créer les tables ;
- enregistrer tous les messages entrants ;
- enregistrer les messages envoyés par le bot.

Livrable : historique complet consultable en base.

---

## Phase 3 — Détection agence / dons / pub

Objectifs :

- ajouter une liste de mots-clés suspects ;
- calculer un score ;
- créer une alerte ;
- envoyer l’alerte dans le groupe admin ;
- stocker l’alerte en base.

Livrable : alertes automatiques dans le groupe admin.

---

## Phase 4 — Workflow broadcast validé

Objectifs :

- détecter `#broadcast` dans le groupe admin ;
- créer un brouillon ;
- demander validation ;
- publier après `OK PUBLIER` ;
- annuler après `ANNULER`.

Livrable : publication multi-groupes validée.

---

## Phase 5 — Messages programmés

Objectifs :

- ajouter Redis / BullMQ ou node-cron ;
- programmer ouverture / fermeture ;
- programmer messages Jumu’a ;
- programmer rappels Rawdah / bagages / horaires.

Livrable : messages automatiques planifiés.

---

## Phase 6 — Récap quotidien

Objectifs :

- extraire les messages des dernières 24h ;
- résumer par groupe ;
- générer un point de situation ;
- envoyer au groupe admin ;
- générer un message du matin.

Livrable : point de situation quotidien automatisé.

---

## Phase 7 — Dashboard

Objectifs :

- afficher groupes ;
- afficher messages ;
- afficher alertes ;
- afficher broadcasts ;
- activer/désactiver les automatisations ;
- gérer les messages programmés.

Livrable : interface de pilotage.

---

# 10. Critères d’acceptation

Le projet est considéré fonctionnel si :

- les messages des groupes surveillés sont bien reçus ;
- tous les messages sont stockés ;
- les messages suspects sont détectés et transférés au groupe admin ;
- le groupe d’origine est clairement mentionné dans l’alerte ;
- les admins peuvent créer un broadcast depuis le groupe admin ;
- le bot attend validation avant publication ;
- les messages d’ouverture et fermeture sont envoyés automatiquement ;
- le récap quotidien est généré et envoyé au groupe admin ;
- le bot ne répond pas à ses propres messages ;
- le bot ne répond pas dans les groupes non autorisés ;
- les clés API ne sont pas exposées publiquement ;
- le système redémarre correctement après reboot Docker / VM.

---

# 11. Points ouverts

À confirmer :

- liste définitive des groupes WhatsApp ;
- ID du groupe admin ;
- catégories de groupes : Hajj, Omra, bénévoles, admins ;
- messages exacts d’ouverture / fermeture ;
- horaires exacts ;
- stratégie de suppression des messages suspects ;
- choix IA final : Ollama seul, Token Router, OmniRoute ou hybride ;
- niveau de conservation des historiques ;
- besoin ou non d’un dashboard V1.

---

# 12. Priorité immédiate

Prochaine étape recommandée :

```txt
Ajouter PostgreSQL et stocker tous les messages entrants.
```

Sans cette étape, les fonctionnalités suivantes seront difficiles à faire proprement :

- récap quotidien ;
- historique des alertes ;
- workflow broadcast ;
- statistiques ;
- dashboard ;
- audit modération.
