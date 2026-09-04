# Xhatsapp Webhook 0.6.0

Récepteur OpenWA signé avec politiques de groupes, modération humaine, diffusion validée, horaires et récapitulatifs quotidiens contrôlés.

La version 0.6.0 utilise OmniRoute par son API compatible OpenAI pour produire un brouillon français distinct par groupe. Aucun brouillon n'est diffusé sans `GO RECAP <CODE>`.

## Horaires des groupes

La console privée `/admin` configure les jours, les heures et les deux messages. Les horaires sont désactivés par défaut.

- Fermeture : envoi du message, puis écriture réservée aux administrateurs.
- Ouverture : écriture autorisée aux membres, puis envoi du message.
- Le compte WhatsApp utilisé par OpenWA doit être administrateur du groupe.
- Le bouton « Vérifier droits » réécrit le réglage actuel sans changer son état.
- PostgreSQL empêche une même action quotidienne de s’exécuter deux fois et autorise jusqu’à trois tentatives après un échec.

## Créer une communication

Dans l'unique groupe `Actif + Admin` :

```text
COMMUNICATION
Texte à diffuser…
```

Xhatsapp crée un brouillon et fige la liste des groupes actuellement `Actif + Diffusion`. Il répond avec une référence opaque et les commandes strictes :

```text
PUBLIER ABC123
ANNULER ABC123
```

Un simple « OK » n'est jamais interprété comme une validation.

## Exécution

- les destinations sont enregistrées en base avant la validation ;
- les envois sont séquentiels avec délai configurable ;
- chaque destination possède son propre statut et compteur de tentatives ;
- une reprise ignore les destinations déjà enregistrées comme envoyées ;
- une diffusion partielle propose `REESSAYER ABC123`, qui cible uniquement les échecs ;
- un récapitulatif est renvoyé dans le groupe administrateur ;
- la version 0.4.0 diffuse uniquement du texte, limité à 3 500 caractères.

## Sécurité

- HMAC OpenWA vérifié avant traitement ;
- groupes refusés par défaut ;
- destinations limitées à `enabled = true` et `allow_broadcast = true` ;
- le groupe administrateur est toujours exclu des destinations ;
- une seule configuration `Actif + Admin` autorisée ;
- références hachées dans les journaux ;
- clé OpenWA dédiée et limitée à la session ;
- accès au groupe WhatsApp administrateur réservé aux opérateurs autorisés.

## Variables

- `DATABASE_URL`
- `OPENWA_WEBHOOK_SECRET`
- `OPENWA_API_URL`
- `OPENWA_SESSION_ID`
- `XHATSAPP_OPENWA_API_KEY`
- `XHATSAPP_ADMIN_TOKEN`
- `XHATSAPP_GROUP_INVENTORY`
- `BROADCAST_SEND_DELAY_MS` (défaut : `750`, maximum : `5000`)
- `SUMMARY_PROVIDER` (`omniroute` par défaut, `ollama` facultatif)
- `SUMMARY_API_URL`
- `SUMMARY_API_KEY`
- `SUMMARY_MODEL`

## Vérifications

```bash
npm run check
npm test
```
