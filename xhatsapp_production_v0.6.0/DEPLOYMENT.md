# Xhatsapp 0.6.0 — installation de production

Ce paquet installe OpenWA, PostgreSQL, Redis, Caddy, le webhook Xhatsapp, OmniRoute, les sauvegardes et la supervision. Il ne contient aucun secret, identifiant WhatsApp ni session.

OmniRoute est la passerelle LLM principale. Son tableau de bord et son API ne sont jamais publiés par Caddy : le port `20128` écoute seulement sur `127.0.0.1`. Ollama avec Gemma 4 reste disponible comme profil local facultatif et n'est pas démarré par défaut.

## Prérequis

- Ubuntu 24.04 LTS amd64 ;
- 4 vCPU, 16 Go de RAM et 120 Go de disque recommandés ;
- ports publics 22, 80 et 443 seulement ;
- domaine pointant vers le serveur ;
- utilisateur administrateur avec clé SSH fonctionnelle.

## Installation sur un serveur neuf

```bash
cd /tmp/xhatsapp_production_v0.6.0
sudo bash host/bootstrap-ubuntu.sh azureuser
```

Se reconnecter en SSH, puis :

```bash
cd /tmp/xhatsapp_production_v0.6.0
sudo bash install-production.sh bot.entraidenusukhajj.fr azureuser
```

Le script génère les secrets sur le serveur, verrouille par digest les images actives et démarre l'infrastructure, dont OmniRoute. Le tag officiel utilisé pour la résolution initiale est `diegosouzapw/omniroute:3.8.50`. Le volume `/app/data` est automatiquement attribué à l'UID 1000 attendu par cette version afin d'éviter une base SQLite en lecture seule.

## Configuration privée d'OmniRoute

Depuis PowerShell Windows, ouvrir le tunnel :

```powershell
ssh -N -i "C:\Users\yahia.abdelkhalki\Admin_key.pem" -L 20128:127.0.0.1:20128 azureuser@ADRESSE_IP
```

Ouvrir `http://127.0.0.1:20128/home`. Pour copier le mot de passe initial sans l'afficher :

```powershell
$password = ssh -i "C:\Users\yahia.abdelkhalki\Admin_key.pem" azureuser@ADRESSE_IP "sudo sed -n 's/^OMNIROUTE_INITIAL_PASSWORD=//p' /opt/xhatsapp/.env"
$password.Trim() | Set-Clipboard
Remove-Variable password
```

Dans OmniRoute :

1. ajouter le fournisseur choisi dans **Providers** et tester sa connexion ;
2. créer dans **Endpoints** une clé réservée à Xhatsapp ;
3. relever l'identifiant exact du modèle ou du combo proposé par cet endpoint ;
4. ne jamais publier cette clé dans une capture, un journal ou cette conversation.

Sur la VM, enregistrer la clé de façon interactive :

```bash
cd /tmp/xhatsapp_production_v0.6.0
sudo bash configure-omniroute.sh IDENTIFIANT_EXACT_DU_MODELE
```

Le script demande la clé sans l'afficher, vérifie `/v1/models`, met à jour `.env` et redémarre le webhook s'il existe déjà.

## Association WhatsApp

Ouvrir un second tunnel vers OpenWA :

```powershell
ssh -N -i "C:\Users\yahia.abdelkhalki\Admin_key.pem" -L 2785:127.0.0.1:2785 azureuser@ADRESSE_IP
```

Ouvrir `http://127.0.0.1:2785`, créer la session et scanner le QR. Copier la clé maître sans l'afficher :

```powershell
$key = ssh -i "C:\Users\yahia.abdelkhalki\Admin_key.pem" azureuser@ADRESSE_IP "sudo sed -n 's/^OPENWA_API_MASTER_KEY=//p' /opt/xhatsapp/.env"
$key.Trim() | Set-Clipboard
Remove-Variable key
```

Lorsque la session est `ready`, relever son UUID et finaliser :

```bash
cd /tmp/xhatsapp_production_v0.6.0
sudo bash finalize-production.sh UUID-DE-LA-SESSION
```

## Mise à niveau depuis Xhatsapp 0.5.1

```bash
cd /tmp/xhatsapp_production_v0.6.0
sudo bash upgrade-to-v0.6.sh
```

Le script sauvegarde le webhook et Compose, met OmniRoute à niveau vers `3.8.50`, corrige automatiquement les permissions de son volume persistant, exécute les tests, applique `006_daily_recaps` et restaure le webhook précédent en cas d'échec. Configurez ensuite le fournisseur, la clé d'endpoint et le modèle avec `configure-omniroute.sh`.

## Console Xhatsapp et récapitulatif

```powershell
ssh -N -i "C:\Users\yahia.abdelkhalki\Admin_key.pem" -L 13000:127.0.0.1:3000 azureuser@ADRESSE_IP
```

Ouvrir `http://127.0.0.1:13000/admin`. Configurer un seul `Groupe_admin`, puis cocher `Récapitulatif` uniquement pour les groupes voulus. La signature reste modifiable dans cette console.

À 20 h 10, heure de Paris, Xhatsapp demande à OmniRoute un texte français distinct pour chaque groupe sélectionné. L'aperçu arrive uniquement dans `Groupe_admin`. La publication exige une commande exacte :

```text
GO RECAP ABC234
ANNULER RECAP ABC234
REESSAYER RECAP ABC234
```

Un simple « go » ne fait rien. Une reprise ignore les destinations déjà envoyées.

## Contrôles

```bash
sudo docker compose --env-file /opt/xhatsapp/.env -f /opt/xhatsapp/docker-compose.yml ps
curl -fsS http://127.0.0.1:20128/api/monitoring/health | jq .
curl -fsS http://127.0.0.1:3000/health | jq .
sudo systemctl start xhatsapp-health.service
```

La racine HTTPS publique doit retourner `404`, un webhook non signé `401`, et `/api/health/ready` doit retourner `200`.

## Sécurité et sauvegardes

- ne jamais publier `/opt/xhatsapp/.env` ;
- ne jamais ouvrir publiquement 20128, 2785, 3000, 5432, 6379 ou 11434 ;
- configurer OmniRoute seulement par tunnel SSH ;
- les sauvegardes arrêtent proprement OmniRoute, copient `/app/data`, puis le redémarrent afin de préserver SQLite ;
- tester le durcissement SSH dans une seconde session avant de fermer la première ;
- conserver l'archive et son empreinte SHA-256.

## Secours local facultatif

Le profil `local-llm` conserve Ollama/Gemma 4 pour un futur basculement local. Il n'est ni téléchargé ni démarré par l'installation standard. Son activation exige de verrouiller l'image Ollama par digest, de télécharger le modèle et de remplacer les variables `SUMMARY_*` ; elle doit faire l'objet d'une recette séparée.
