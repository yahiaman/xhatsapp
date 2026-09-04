# Notes de version — Xhatsapp 0.6.0

## Nouveautés

- installation d'OmniRoute 3.8.50 par Docker, image verrouillée par digest au déploiement ;
- tableau de bord/API OmniRoute accessibles uniquement sur `127.0.0.1:20128` ;
- clé d'endpoint OmniRoute dédiée à Xhatsapp et modèle vérifié avant enregistrement ;
- génération en français d'un récapitulatif séparé par groupe à 20 h 10 ;
- aperçu envoyé uniquement dans `Groupe_admin` ;
- validation stricte par `GO RECAP <CODE>`, annulation et reprise idempotente ;
- signature configurable dans la console Xhatsapp ;
- sauvegarde cohérente des données persistantes OmniRoute ;
- supervision d'OmniRoute, de sa clé d'endpoint et du modèle sélectionné ;
- healthcheck compatible avec OmniRoute 3.8.50 via `/api/monitoring/health` ;
- correction automatique du propriétaire du volume `/app/data` vers l'UID 1000 attendu par OmniRoute 3.8.50 ;
- attente du retour à l'état sain après la sauvegarde cohérente de SQLite ;
- profil Ollama/Gemma 4 conservé comme secours local facultatif, arrêté par défaut.

## Comportement sûr lors de la mise à niveau

Tous les groupes ont `Récapitulatif = désactivé` après la migration. Tant que `SUMMARY_API_KEY` et `SUMMARY_MODEL` valent `pending`, aucune génération LLM ne peut réussir. Les fonctions déjà validées de Xhatsapp 0.5.1 restent actives.

## Ordre recommandé sur le serveur actuel

1. copier et vérifier l'archive ;
2. lancer `sudo bash upgrade-to-v0.6.sh` ;
3. ouvrir le tunnel SSH OmniRoute ;
4. configurer un fournisseur et créer la clé d'endpoint Xhatsapp ;
5. lancer `sudo bash configure-omniroute.sh <modele>` ;
6. tester un récapitulatif sur `Groupe_01` avant d'activer un groupe de production.
