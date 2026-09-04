# Xhatsapp — Pilotage et Automatisation Multi-Groupes WhatsApp

Système de gestion, modération, diffusion ciblée, contrôle des horaires et récapitulatifs quotidiens par IA pour les groupes WhatsApp liés aux activités Hajj, Omra, bénévoles et administration.

---

## 📁 Structure du dépôt

- **[`preview.md`](preview.md)** : Cahier des charges fonctionnel et technique initial.
- **[`xhatsapp_production_v0.6.0/`](xhatsapp_production_v0.6.0/)** : Socle complet de production version 0.6.0.
  - `docker-compose.yml` : Orchestration des conteneurs (OpenWA, Postgres, Redis, OmniRoute, Webhook, Caddy).
  - `webhook/` : Application Node.js (modération, diffusion, horaires, API admin, récapitulatifs).
  - `host/` : Scripts d'initialisation et de durcissement système (Ubuntu 24.04, UFW, fail2ban, SSH).
  - `ops/` : Tâches d'exploitation automatisées (sauvegardes cohérentes à 03h15, supervision 5 min avec alertes WhatsApp).
  - `DEPLOYMENT.md` : Guide complet d'installation et de mise en production.
  - `RELEASE_NOTES.md` : Notes de version v0.6.0.

---

## 🚀 Démarrage rapide

Pour déployer sur une machine hôte Ubuntu 24.04 :

1. Consulter le guide détaillé : [`xhatsapp_production_v0.6.0/DEPLOYMENT.md`](xhatsapp_production_v0.6.0/DEPLOYMENT.md).
2. Lancer la préparation du serveur avec `sudo bash host/bootstrap-ubuntu.sh <user>`.
3. Déployer l'infrastructure avec `sudo bash install-production.sh <domaine> <user>`.
