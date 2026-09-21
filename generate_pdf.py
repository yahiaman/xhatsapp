import os
import subprocess
import sys

HTML_CONTENT = r"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Dossier d'Exploitation & Guide des Commandes Administrateurs — Xhatsapp 0.6.0</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 14mm 12mm 14mm;
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 8.8pt;
      line-height: 1.4;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* HEADER BANNER */
    .header-banner {
      background: linear-gradient(135deg, #064e3b 0%, #0f766e 100%);
      color: white;
      padding: 16px 22px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
    }

    .header-banner h1 {
      margin: 0 0 4px 0;
      font-size: 16pt;
      font-weight: 700;
      letter-spacing: -0.4px;
    }

    .header-banner .subtitle {
      font-size: 10pt;
      color: #ccfbf1;
      font-weight: 500;
      margin: 0;
    }

    .header-banner .badge-version {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.35);
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 8.5pt;
      font-weight: 600;
      text-align: right;
      white-space: nowrap;
    }

    /* TITRES */
    h2 {
      font-size: 11.5pt;
      color: #064e3b;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 3px;
      margin-top: 14px;
      margin-bottom: 8px;
      font-weight: 700;
      page-break-after: avoid;
    }

    h3 {
      font-size: 9.8pt;
      color: #0f766e;
      margin-top: 10px;
      margin-bottom: 5px;
      font-weight: 650;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 6px 0;
      text-align: justify;
    }

    /* TABLES */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 10px 0;
      font-size: 8pt;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
      vertical-align: middle;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* CODES & BADGES */
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8pt;
      background: #e2e8f0;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 600;
    }

    .cmd-badge {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8pt;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
      white-space: nowrap;
    }

    .cmd-badge-danger {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .cmd-badge-blue {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }

    /* CARTES & ENCADRÉS */
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      page-break-inside: avoid;
    }

    .callout {
      padding: 8px 12px;
      border-radius: 6px;
      margin: 8px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    .callout-info {
      background: #f0fdfa;
      border-left: 4px solid #0d9488;
      color: #134e4a;
    }

    .callout-warning {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      color: #78350f;
    }

    .callout-success {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      color: #14532d;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 8px 0;
      page-break-inside: avoid;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin: 8px 0;
      page-break-inside: avoid;
    }

    .footer-doc {
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px solid #cbd5e1;
      font-size: 7.5pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }

    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- ==================== PAGE 1 : PRÉSENTATION & ARCHITECTURE ==================== -->
  <div class="header-banner">
    <div>
      <h1>Dossier d’Exploitation (DEX) & Guide des Commandes</h1>
      <p class="subtitle">Communauté d'Entraide Nusuk Hajj 1447 / 2026 — Plateforme Xhatsapp 0.6.0</p>
    </div>
    <div class="badge-version">
      Usage Interne & Exploitation<br>
      <small style="font-weight: normal; opacity: 0.9;">Mise à jour : Septembre 2026</small>
    </div>
  </div>

  <div class="callout callout-info" style="margin-top:0;">
    <strong>Objet du document :</strong> Manuel opérationnel et technique destiné à l'équipe d'administration, aux modérateurs de la communauté et aux exploitants du serveur VPS. Il synthétise l'inventaire complet des commandes WhatsApp, l'utilisation de la console Web <code>/admin</code>, ainsi que les fiches réflexes de dépannage et de maintenance.
  </div>

  <h2>1. Cartographie & Typologie des Groupes WhatsApp</h2>
  <p>La plateforme Xhatsapp supervise 7 groupes au total sur l'infrastructure de production, divisés en 3 catégories aux rôles rigoureusement isolés :</p>

  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Type de Groupe</th>
        <th style="width: 38%;">Identifiant & Groupes Assignés</th>
        <th style="width: 38%;">Rôle Opérationnel du Bot</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>🏢 Groupe Admin</strong><br><span style="font-size: 7.5pt; color:#64748b;">(Pilotage Exclusif)</span></td>
        <td><code>Groupe de travail admin/ modérateur</code><br><span style="font-size: 7.5pt; color:#64748b;">120363429965426711@g.us</span></td>
        <td>Reçoit toutes les alertes (modération, citations d'agences, sentinelle panique). Exécute les commandes de contrôle global (blocage d'urgence, bans, audits de doublons, diffusions officielles).</td>
      </tr>
      <tr>
        <td><strong>🕋 Groupes Surveillés</strong><br><span style="font-size: 7.5pt; color:#64748b;">(Production Pèlerins)</span></td>
        <td>
          • <code>🕋1 Entraide Nusuk Hajj 2027🕋</code><br>
          • <code>🕋2 Entraide Nusuk Hajj 2027🕋</code><br>
          • <code>🕋3 Entraide Nusuk Hajj 2027🕋</code><br>
          • <code>🕋4 Entraide Nusuk Hajj 2027🕋</code><br>
          • <code>🕋5 Entraide Nusuk Hajj 2027🕋</code>
        </td>
        <td>Surveillance active en temps réel : suppression automatique immédiate des noms d'agences, contrôle anti-doublon aux demandes d'adhésion, ouverture matinale et fermeture nocturne programmées, partage instantané des fiches officielles via les raccourcis <code>!cmd</code>.</td>
      </tr>
      <tr>
        <td><strong>🧪 Groupe Test</strong><br><span style="font-size: 7.5pt; color:#64748b;">(Pré-production)</span></td>
        <td><code>Groupe_01</code><br><span style="font-size: 7.5pt; color:#64748b;">120363428902045062@g.us</span></td>
        <td>Bénéficie de toutes les règles des groupes surveillés. Permet de tester en conditions réelles les horaires, raccourcis et messages avant diffusion générale.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Architecture Technique & Principes Directeurs</h2>
  <div class="grid-3">
    <div class="card" style="margin-bottom:0;">
      <h3 style="margin-top:0;">🛡️ Neutralité Absolue</h3>
      <p style="font-size:7.8pt;">Interdiction stricte de toute citation, recommandation ou critique d'agence de voyage. Toute mention est supprimée à la seconde même avec message éducatif.</p>
    </div>
    <div class="card" style="margin-bottom:0;">
      <h3 style="margin-top:0;">🤝 Fraternité & Anti-Doublon</h3>
      <p style="font-size:7.8pt;">Afin de garantir des places au maximum de futurs pèlerins, chaque membre n'est autorisé que dans un seul groupe de discussion. Tous les groupes reçoivent les mêmes informations.</p>
    </div>
    <div class="card" style="margin-bottom:0;">
      <h3 style="margin-top:0;">⚡ Performance 0 ms</h3>
      <p style="font-size:7.8pt;">Les commandes et raccourcis officiels sont résolus en mémoire vive sans requêtes superflues, garantissant une réactivité immédiate sans saturer la passerelle WhatsApp.</p>
    </div>
  </div>

  <div class="footer-doc">
    <div>Plateforme Xhatsapp 0.6.0 — Entraide Nusuk Hajj 1447 / 2026</div>
    <div>Page 1 / 5</div>
  </div>

  <!-- ==================== PAGE 2 : TABLEAU SYNTHÉTIQUE ==================== -->
  <div class="page-break"></div>

  <h2>3. Tableau Synthétique des Commandes Administrateurs</h2>
  <p>Toutes les commandes utilisables sur WhatsApp par l'équipe d'administration et de modération :</p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Commande</th>
        <th style="width: 17%;">Espace</th>
        <th style="width: 15%;">Rôle Requis</th>
        <th style="width: 43%;">Action Immédiate</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="cmd-badge cmd-badge-danger">BLOCK ALL</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Verrouille tous les groupes surveillés en mode "Annonce uniquement".</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">UNBLOCK ALL</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Déverrouille tous les groupes et diffuse l'avis officiel de réouverture.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge cmd-badge-danger">FLASH &lt;texte&gt;</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Verrouille tous les groupes et diffuse l'alerte prioritaire encadrée.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge cmd-badge-danger">BAN &lt;num&gt; [motif]</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Expulse le membre de tous les groupes et l'inscrit en liste noire.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">UNBAN &lt;numéro&gt;</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Retire le numéro de la liste noire (autorise sa réadmission).</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">LISTE BAN</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Affiche tous les numéros bannis avec motifs et dates.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge cmd-badge-blue">DOUBLONS</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Audit en direct des pèlerins présents dans plusieurs groupes.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge cmd-badge-blue">MODERATEURS</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Affiche la liste blanche des modérateurs exemptés d'anti-doublon.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge cmd-badge-blue">STATUT</span> / <span class="cmd-badge cmd-badge-blue">SANTE</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Bilan de santé (session WA, membres, état verrouillage, horaires).</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">SUPPRIMER &lt;CODE&gt;</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Supprime le message signalé par la modération (cagnotte, pub).</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">IGNORER &lt;CODE&gt;</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Conserve le message signalé et classe l'alerte sans action.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge cmd-badge-blue">COMMUNICATION</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Prépare un brouillon de diffusion multi-groupes avec code de validation.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">PUBLIER &lt;CODE&gt;</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Valide et expédie la diffusion officielle dans tous les groupes.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">GO RECAP &lt;CODE&gt;</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Valide et publie le récapitulatif quotidien de 20h10 (IA).</td>
      </tr>
      <tr>
        <td><span class="cmd-badge cmd-badge-blue">RESSOURCES</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Affiche l'ensemble des fiches et raccourcis officiels configurés.</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">SET LIEN &lt;id&gt; &lt;url&gt;</span></td>
        <td>Groupe Admin</td>
        <td>Admins</td>
        <td>Met à jour directement l'URL d'un raccourci (ex: <code>SET LIEN soeurs ...</code>).</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">!youtube</span>, <span class="cmd-badge">!serie</span>...</td>
        <td>Groupes Pèlerins</td>
        <td><strong>Admins & Mods</strong></td>
        <td>Partage instantanément la fiche officielle demandée (latence 0 ms).</td>
      </tr>
      <tr>
        <td><span class="cmd-badge">!liens</span> / <span class="cmd-badge">!ressources</span></td>
        <td>Groupes Pèlerins</td>
        <td><strong>Admins & Mods</strong></td>
        <td>Partage le catalogue complet de tous les liens d'entraide.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-warning">
    <strong>Règle de sécurité :</strong> Les commandes tapées dans le groupe admin ne sont jamais relayées aux pèlerins. Les réponses d'audit, de statut ou de prévisualisation restent strictement confinées dans le <code>Groupe de travail admin/ modérateur</code>.
  </div>

  <div class="footer-doc">
    <div>Plateforme Xhatsapp 0.6.0 — Entraide Nusuk Hajj 1447 / 2026</div>
    <div>Page 2 / 5</div>
  </div>

  <!-- ==================== PAGE 3 : DÉTAIL COMMANDES DU GROUPE ADMIN ==================== -->
  <div class="page-break"></div>

  <h2>4. Détail des Commandes du Groupe Admin (`Groupe de travail admin/ modérateur`)</h2>

  <h3>4.1. Commandes d'Urgence & Sécurité Opérationnelle</h3>
  <div class="card">
    <p><strong>🚨 <code>BLOCK ALL</code> (ou <code>VERROUILLER TOUT</code>) :</strong> Passe instantanément tous les groupes de pèlerins en mode <em>« Seuls les administrateurs peuvent envoyer des messages »</em>. Le bot diffuse automatiquement l'avis officiel de verrouillage temporaire.</p>
    <p><strong>🔓 <code>UNBLOCK ALL</code> (ou <code>DEVERROUILLER TOUT</code>) :</strong> Rouvre immédiatement la parole à tous les participants dans tous les groupes surveillés et diffuse l'avis officiel de réouverture invitant à la fraternité et au respect des règles.</p>
    <p><strong>⚡ <code>FLASH &lt;Votre message&gt;</code> :</strong> Procédure d'alerte officielle en deux temps :
      <br>1. Verrouille immédiatement tous les groupes de pèlerins pour interrompre les flux.
      <br>2. Diffuse le message encadré par le bandeau officiel <em>🚨 FLASH INFO OFFICIEL NUSUK 🚨</em>.
      <br><em>NB : Les groupes restent verrouillés après le flash pour garantir la lecture de l'information. Tapez <code>UNBLOCK ALL</code> dès que vous souhaitez rouvrir les échanges.</em>
    </p>
  </div>

  <h3>4.2. Modération, Bannissements & Gestion des Doublons</h3>
  <div class="card">
    <p><strong>🚫 <code>BAN &lt;numéro&gt; [motif]</code> :</strong>
      <br>• Vérifie que le numéro n'est pas modérateur (protection anti-erreur).
      <br>• Expulse immédiatement le participant de l'ensemble des groupes surveillés.
      <br>• Rejette ses demandes d'adhésion en attente et inscrit le numéro dans la <strong>liste noire permanente</strong>.
      <br><em>Exemples :</em> <code>BAN 0612345678 Publicité abusive</code> ou <code>BAN +33612345678 Faux visa</code>.
    </p>
    <p><strong>✅ <code>UNBAN &lt;numéro&gt;</code> :</strong> Retire le numéro de la liste noire et autorise à nouveau son entrée dans les groupes.</p>
    <p><strong>📋 <code>LISTE BAN</code> (ou <code>BLACKLIST</code>) :</strong> Affiche la liste complète des membres bannis, leurs motifs et les dates.</p>
    <p><strong>👥 <code>DOUBLONS</code> (ou <code>AUDIT DOUBLONS</code>) :</strong> Analyse en direct l'ensemble des membres présents dans plus d'un groupe surveillé. <em>Les administrateurs et modérateurs enregistrés sont automatiquement exclus du rapport d'audit.</em></p>
    <p><strong>🛡️ <code>MODERATEURS</code> :</strong> Affiche les téléphones de la liste blanche (coordonnateurs et comptes de secours autorisés partout).</p>
    <p><strong>📊 <code>STATUT</code> (ou <code>SANTE</code>) :</strong> Bilan en temps réel : état de la session WhatsApp, nombre de membres par groupe, statut de verrouillage et horaires des automatisations.</p>
  </div>

  <h3>4.3. Traitement des Alertes de Modération Manuelle</h3>
  <div class="card">
    <p>Lorsqu'un message suspect (appel aux dons, cagnotte ou offre commerciale) est détecté, le bot transmet une alerte dans le groupe admin :</p>
    <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 6px 10px; border-radius: 5px; font-size: 8pt; margin: 4px 0;">
      🚨 <strong>Alerte de modération Xhatsapp</strong> — Réf : <strong>K7X9P2</strong><br>
      📋 Motif : don, cagnotte ou appel aux dons | 👥 Groupe : 🕋1 Entraide Nusuk Hajj 2027🕋<br>
      👤 Auteur : Pèlerin (+336...) | Message : <em>"Faites un don pour le puits..."</em>
    </div>
    <p>• <strong><code>SUPPRIMER K7X9P2</code> :</strong> Supprime le message dans le groupe pèlerin pour tout le monde.<br>
       • <strong><code>IGNORER K7X9P2</code> :</strong> Conserve le message et classe l'alerte sans action.</p>
  </div>

  <h3>4.4. Diffusions Multi-Groupes & Récapitulatif Quotidien</h3>
  <div class="card">
    <p><strong>📣 <code>COMMUNICATION</code> (Diffusion officielle) :</strong> Envoyez un message dont la première ligne est exactement le mot <code>COMMUNICATION</code>. Le bot génère un aperçu avec un code de confirmation unique à 6 caractères :</p>
    <p>• Tapez <strong><code>PUBLIER &lt;CODE&gt;</code></strong> pour lancer l'envoi échelonné (protection anti-ban).<br>
       • Tapez <strong><code>ANNULER &lt;CODE&gt;</code></strong> pour abandonner le brouillon.<br>
       • Tapez <strong><code>REESSAYER &lt;CODE&gt;</code></strong> en cas d'erreur réseau pour ne relancer que les groupes en échec.</p>
    <p><strong>📰 Récapitulatif Quotidien de 20h10 :</strong> Chaque soir à 20h10, l'IA analyse les échanges de la journée et propose une synthèse bienveillante dans le groupe admin :<br>
       • <strong><code>GO RECAP &lt;CODE&gt;</code> :</strong> Valide et diffuse le récapitulatif dans tous les groupes.<br>
       • <strong><code>ANNULER RECAP &lt;CODE&gt;</code> :</strong> Rejette le résumé proposé.</p>
  </div>

  <div class="footer-doc">
    <div>Plateforme Xhatsapp 0.6.0 — Entraide Nusuk Hajj 1447 / 2026</div>
    <div>Page 3 / 5</div>
  </div>

  <!-- ==================== PAGE 4 : RACCOURCIS PÈLERINS & CONSOLE WEB ADMIN ==================== -->
  <div class="page-break"></div>

  <h2>5. Raccourcis de Liens dans les Groupes Pèlerins (`🕋1` à `🕋5`, `Groupe_01`)</h2>
  <div class="callout callout-success">
    <strong>Protection Anti-Spam & Latence 0 ms :</strong> Ces raccourcis sont <strong>strictement réservés aux administrateurs et modérateurs</strong> des groupes. Si un pèlerin ordinaire les tape, le bot les ignore silencieusement pour éviter tout débordement. La réponse est <strong>instantanée (0 ms)</strong> grâce au cache en mémoire des numéros modérateurs.
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Commande</th>
        <th style="width: 28%;">Ressource Officielle</th>
        <th style="width: 50%;">Description du Contenu Partagé</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>!youtube</code></td>
        <td>Chaîne YouTube Officielle</td>
        <td>Lien direct vers la chaîne officielle d'entraide Nusuk Hajj.</td>
      </tr>
      <tr>
        <td><code>!Série</code> ou <code>!serie</code></td>
        <td>Série Complète Nusuk</td>
        <td>Playlist complète des vidéos de préparation étape par étape.</td>
      </tr>
      <tr>
        <td><code>!podcast</code></td>
        <td>Podcasts Entraide Hajj</td>
        <td>Playlist des épisodes audio/vidéo et retours d'expérience.</td>
      </tr>
      <tr>
        <td><code>!tuto</code></td>
        <td>Tutoriels Pas-à-Pas</td>
        <td>Playlist des tutoriels pratiques (inscription, plateformes).</td>
      </tr>
      <tr>
        <td><code>!live</code></td>
        <td>Rediffusions des Lives</td>
        <td>Playlist des sessions de questions / réponses en direct.</td>
      </tr>
      <tr>
        <td><code>!soeurs</code></td>
        <td>Groupe Telegram Sœurs</td>
        <td>Lien d'invitation au groupe d'entraide dédié aux sœurs.</td>
      </tr>
      <tr>
        <td><code>!site</code></td>
        <td>Portail Web Officiel</td>
        <td>Lien du portail web officiel de la communauté.</td>
      </tr>
      <tr>
        <td><code>!faq</code></td>
        <td>Foire Aux Questions</td>
        <td>Réponses aux questions les plus fréquentes sur les démarches.</td>
      </tr>
      <tr>
        <td><code>!hotels</code></td>
        <td>Localisation des Hôtels</td>
        <td>Cartes interactives des hôtels à La Mecque et Médine.</td>
      </tr>
      <tr>
        <td><code>!packages</code></td>
        <td>Guide des Offres & Forfaits</td>
        <td>Guide d'analyse et comparatifs des formules officielles.</td>
      </tr>
      <tr>
        <td><code>!retouche</code></td>
        <td>Retouche Photo Passeport</td>
        <td>Outil en ligne de mise en conformité des photos Nusuk.</td>
      </tr>
      <tr>
        <td><code>!liens</code> ou <code>!all</code></td>
        <td>Catalogue Complet</td>
        <td>Fiche récapitulative regroupant l'ensemble des liens ci-dessus.</td>
      </tr>
    </tbody>
  </table>

  <h2>6. Guide d'Utilisation de la Console Web `/admin`</h2>
  <div class="card">
    <p><strong>🌐 Procédure de connexion sécurisée depuis votre PC Windows :</strong>
      <br>1. Lancez <code>.\tunnel-xhatsapp.ps1</code> dans PowerShell.
      <br>2. Choisissez l'option <strong>[1]</strong> pour ouvrir le tunnel SSH (Port 13000 vers port interne 3000).
      <br>3. Choisissez l'option <strong>[5]</strong> pour copier automatiquement votre clé <code>XHATSAPP_ADMIN_TOKEN</code>.
      <br>4. Ouvrez Google Chrome sur <strong><code>http://127.0.0.1:13000/admin</code></strong>, collez le jeton et connectez-vous.
    </p>
  </div>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top:0;">👥 Gestion des Groupes & Synchronisation</h3>
      <p>• <strong>Bouton « Actualiser l'inventaire » :</strong> Réinterroge WhatsApp pour détecter les nouveaux groupes créés ou renommés.</p>
      <p>• <strong>Droits par groupe :</strong> Activez en un clic la <em>Surveillance</em>, le statut <em>Admin</em> ou le mode <em>Test</em> pour chaque groupe.</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">🏢 Dictionnaires de Modération</h3>
      <p>• <strong>Agences interdites :</strong> Suppression automatique et immédiate avec envoi du rappel de neutralité dans le groupe.</p>
      <p>• <strong>Dons & Publicités :</strong> Mots-clés déclenchant une alerte admin.</p>
      <p>• <strong>Modérateurs :</strong> Gestion de la liste blanche anti-doublon.</p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <h3 style="margin-top:0;">🔗 Onglet Liens & Ressources</h3>
      <p>• Ajoutez de nouveaux raccourcis (ex: <code>!guide</code>, <code>!visa</code>).</p>
      <p>• Modifiez les URLs cibles, descriptions et mots-clés de détection naturelle sans redémarrer le serveur.</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">💬 Personnalisation des Messages</h3>
      <p>• Message d'ouverture matinale & fermeture nocturne.</p>
      <p>• Rappel de neutralité agence après suppression.</p>
      <p>• Message de bienvenue (Onboarding) et refus de doublon.</p>
    </div>
  </div>

  <div class="footer-doc">
    <div>Plateforme Xhatsapp 0.6.0 — Entraide Nusuk Hajj 1447 / 2026</div>
    <div>Page 4 / 5</div>
  </div>

  <!-- ==================== PAGE 5 : EXPLOITATION SERVEUR & DÉPANNAGE ==================== -->
  <div class="page-break"></div>

  <h2>7. Exploitation Technique & Fiches Réflexes Serveur</h2>

  <h3>7.1. Infrastructure & Commandes VPS (Ubuntu Linux)</h3>
  <div class="card">
    <p>Connexion SSH : <code>ssh -i "C:\Users\yahia.abdelkhalki\Admin_key.pem" azureuser@20.19.180.187</code></p>
    <table>
      <thead>
        <tr>
          <th style="width: 32%;">Action Requise</th>
          <th style="width: 68%;">Commande Bash Linux sur le Serveur</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Vérifier l'état des conteneurs</td>
          <td><code>sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"</code></td>
        </tr>
        <tr>
          <td>Suivre les logs du Webhook en direct</td>
          <td><code>sudo docker logs -f --tail 100 xhatsapp-webhook</code></td>
        </tr>
        <tr>
          <td>Suivre les logs WhatsApp (OpenWA)</td>
          <td><code>sudo docker logs -f --tail 50 xhatsapp-openwa</code></td>
        </tr>
        <tr>
          <td>Vérifier la session WhatsApp</td>
          <td><code>sudo docker exec xhatsapp-openwa curl -s http://127.0.0.1:2785/api/health/ready</code></td>
        </tr>
        <tr>
          <td>Recompiler et redémarrer le Webhook</td>
          <td><code>cd /opt/xhatsapp && sudo docker compose build webhook && sudo docker compose up -d webhook</code></td>
        </tr>
        <tr>
          <td>Déclencher une sauvegarde immédiate</td>
          <td><code>sudo systemctl start xhatsapp-backup.service</code></td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>7.2. Fiches Réflexes : Résolution d'Incidents Fréquents</h3>

  <div class="callout callout-warning">
    <strong>🚨 Incident 1 : Le bot ne répond plus et ne modère plus les messages</strong><br>
    <strong>Cause probable :</strong> La session WhatsApp s'est déconnectée sur le smartphone officiel du bot.<br>
    <strong>Procédure de rétablissement :</strong>
    <br>1. Ouvrez le tunnel OpenWA via <code>.\tunnel-xhatsapp.ps1</code> (Option 2).
    <br>2. Ouvrez Chrome sur <code>http://127.0.0.1:2785</code>.
    <br>3. Si la session est en statut <em>disconnected</em> ou <em>qr</em>, cliquez sur <strong>Scan QR</strong>.
    <br>4. Ouvrez WhatsApp sur le smartphone &rarr; <em>Appareils connectés</em> &rarr; <em>Connecter un appareil</em> et scannez le code.
    <br>5. Dès que l'état redevient vert (<code>ready</code>), le bot reprend automatiquement toutes ses activités sans redémarrage.
  </div>

  <div class="callout callout-warning">
    <strong>🚨 Incident 2 : Un membre banni réussit à poster dans un groupe</strong><br>
    <strong>Cause probable :</strong> Le numéro a été enregistré sous un format incomplet ou sans indicatif international.<br>
    <strong>Action corrective :</strong> Tapez directement dans le groupe admin : <code>BAN +336... Motif</code>. Le bot l'expulsera sur-le-champ de l'ensemble des groupes surveillés et verrouillera son accès.
  </div>

  <div class="callout callout-warning">
    <strong>🚨 Incident 3 : Un pèlerin signale qu'il ne peut pas rejoindre un second groupe</strong><br>
    <strong>Cause normale :</strong> Règle de protection multi-groupes (1 seul groupe par pèlerin pour laisser des places aux autres).<br>
    <strong>Réponse type :</strong> Rappelez au pèlerin que tous les groupes reçoivent strictement les mêmes informations officielles et le même récapitulatif quotidien. S'il s'agit d'un membre de l'équipe d'organisation, ajoutez son numéro dans la liste des <em>Modérateurs & Exemptés</em> sur la console web <code>/admin</code>.
  </div>

  <div class="card" style="background: #f8fafc;">
    <h3 style="margin-top:0;">🛡️ Sentinelle Anti-Panique (Détection automatique de rumeurs)</h3>
    <p>Le bot écoute en permanence les termes d'affolement (<em>arnaque</em>, <em>escroquerie</em>, <em>scandale</em>, <em>faux visa</em>, <em>bloqué aéroport</em>, <em>vol d'argent</em>). Dès qu'un message contient l'un de ces termes dans un groupe de pèlerins, une alerte discrète est immédiatement envoyée dans le groupe admin avec le texte intégral et le nom de l'auteur, permettant à l'équipe de désamorcer la rumeur ou d'intervenir rapidement.</p>
  </div>

  <div class="footer-doc">
    <div>Plateforme Xhatsapp 0.6.0 — Entraide Nusuk Hajj 1447 / 2026</div>
    <div>Page 5 / 5 — Confidentiel & Usage Interne</div>
  </div>

</body>
</html>
"""

def generate_pdf():
    html_path = os.path.abspath("dossier_exploitation.html")
    pdf_path = os.path.abspath("Dossier_Exploitation_Xhatsapp_Admin.pdf")
    
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(HTML_CONTENT)
    print(f"Fichier HTML genere : {html_path}")
    
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        print(f"Erreur : Chrome introuvable a {chrome_path}")
        sys.exit(1)
        
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    
    print("Generation du PDF avec Google Chrome headless...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 0:
        print(f"PDF genere avec succes ! Taille : {os.path.getsize(pdf_path)} octets")
        print(f"Chemin du fichier : {pdf_path}")
    else:
        print("Erreur lors de la generation du PDF")
        print("Sortie Chrome :", result.stdout)
        print("Erreur Chrome :", result.stderr)
        sys.exit(1)

if __name__ == "__main__":
    generate_pdf()
