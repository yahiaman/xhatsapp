# Exploitation Xhatsapp 0.6

Composants d'exploitation inclus dans Xhatsapp 0.6.0.

- sauvegarde vérifiée chaque jour à 03:15, avec délai aléatoire maximal de 15 minutes ;
- bases et rôles PostgreSQL, données persistantes OpenWA/Redis/OmniRoute et configuration complète ;
- conservation des sauvegardes quotidiennes pendant 14 jours ;
- contrôle toutes les cinq minutes des conteneurs, bases, endpoints, modèle OmniRoute, certificat HTTPS, disque et dernière sauvegarde ;
- alerte dans l’unique groupe administrateur au premier échec, rappel au maximum horaire, puis message de rétablissement ;
- journaux disponibles dans `journalctl`.

La copie locale contient `.env` et les rôles PostgreSQL : `/var/backups/xhatsapp` est donc limité à `root`.

Installation depuis le paquet de production :

```bash
sudo bash /tmp/xhatsapp_production_v0.6.0/ops/install.sh
```

Le client PostgreSQL est installé automatiquement s’il manque.
