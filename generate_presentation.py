import os
import pptx
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck(output_path):
    prs = pptx.Presentation()
    # 16:9 widescreen
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Colors
    c_emerald = RGBColor(16, 74, 54)      # #104A36 - Deep Islam/Hajj Green
    c_gold = RGBColor(201, 151, 35)       # #C99723 - Mecca Gold
    c_dark = RGBColor(30, 41, 59)         # #1E293B - Slate Dark
    c_gray_bg = RGBColor(248, 250, 252)   # #F8FAFC - Soft Background
    c_white = RGBColor(255, 255, 255)
    c_card_border = RGBColor(226, 232, 240)
    c_red = RGBColor(220, 38, 38)
    c_muted = RGBColor(100, 116, 139)

    def set_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = c_gray_bg
        bg.line.fill.background()
        return bg

    def add_header(slide, title_text, category="COMMUNAUTÉ ENTRAIDE NUSUK HAJJ 1447 / 2026"):
        # Top banner line
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, Inches(0.12))
        line.fill.solid()
        line.fill.fore_color.rgb = c_gold
        line.line.fill.background()

        # Category / Subtitle
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.35))
        tf_cat = cat_box.text_frame
        tf_cat.word_wrap = True
        p_cat = tf_cat.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.size = Pt(11)
        p_cat.font.bold = True
        p_cat.font.color.rgb = c_gold

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.7), Inches(0.8))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.size = Pt(24)
        p_t.font.bold = True
        p_t.font.color.rgb = c_emerald

    def add_card(slide, left, top, width, height, title, items, badge="", badge_color=c_emerald):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = c_white
        card.line.color.rgb = c_card_border
        card.line.width = Pt(1.5)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.3)
        tf.margin_right = Inches(0.3)
        tf.margin_top = Inches(0.3)
        tf.margin_bottom = Inches(0.3)

        p0 = tf.paragraphs[0]
        p0.text = title
        p0.font.size = Pt(18)
        p0.font.bold = True
        p0.font.color.rgb = c_emerald
        p0.space_after = Pt(10)

        if badge:
            p_b = tf.add_paragraph()
            p_b.text = f"● {badge}"
            p_b.font.size = Pt(10)
            p_b.font.bold = True
            p_b.font.color.rgb = badge_color
            p_b.space_after = Pt(12)

        for it in items:
            p = tf.add_paragraph()
            p.text = f"• {it}"
            p.font.size = Pt(13)
            p.font.color.rgb = c_dark
            p.space_after = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 1 : TITRE
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = c_emerald
    bg1.line.fill.background()

    # Gold accent box
    accent = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.8), Inches(0.18), Inches(3.8))
    accent.fill.solid()
    accent.fill.fore_color.rgb = c_gold
    accent.line.fill.background()

    tb1 = s1.shapes.add_textbox(Inches(1.3), Inches(1.8), Inches(11.0), Inches(3.8))
    tf1 = tb1.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.text = "ENTRAIDE NUSUK HAJJ 1447 / 2026"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = c_gold
    p.space_after = Pt(14)

    p = tf1.add_paragraph()
    p.text = "Système Automatisé de Modération & Community Management"
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = c_white
    p.space_after = Pt(14)

    p = tf1.add_paragraph()
    p.text = "Guide complet des nouvelles fonctionnalités pour l'équipe d'administration"
    p.font.size = Pt(18)
    p.font.color.rgb = RGBColor(226, 232, 240)
    p.space_after = Pt(28)

    p = tf1.add_paragraph()
    p.text = "🕋 5 000+ pèlerins  |  5 groupes surveillés  |  Protection 24/7  |  Assistance IA de 20h10"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = c_gold

    # -------------------------------------------------------------
    # SLIDE 2 : CONTEXTE & DÉFIS DE LA COMMUNAUTÉ
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    set_bg(s2)
    add_header(s2, "Le Contexte & les Défis de Notre Communauté")
    add_card(s2, Inches(0.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "👥 5 000+ Futurs Pèlerins",
             [
                 "Forte affluence de candidats au Hajj.",
                 "WhatsApp impose une limite maximale de participants par groupe.",
                 "Multiplication des groupes nécessaires (Groupe 01 à 05).",
                 "Nécessité absolue de fluidifier les places disponibles."
             ],
             "ENJEU CAPACITÉ", c_emerald)

    add_card(s2, Inches(4.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "🛡️ Neutralité & Rumeurs",
             [
                 "Risque majeur de démarchage commercial et d'arnaques.",
                 "Citation d'agences de voyage sources de conflits.",
                 "Diffusion virale de fausses rumeurs (vols annulés, etc.).",
                 "Dons et cagnottes non autorisés."
             ],
             "ENJEU SÉRÉNITÉ", c_red)

    add_card(s2, Inches(8.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "🤖 La Solution Xhatsapp",
             [
                 "Bot WhatsApp intelligent et autonome 24h/24.",
                 "Filtrage immédiat et alertes dans Groupe_admin.",
                 "Protection anti-doublon et MP d'accueil aux pèlerins.",
                 "Récapitulatif quotidien commun généré par IA."
             ],
             "AUTOMATISATION", c_gold)

    # -------------------------------------------------------------
    # SLIDE 3 : ARCHITECTURE DU DISPOSITIF
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    set_bg(s3)
    add_header(s3, "Architecture & Fonctionnement Général")
    add_card(s3, Inches(0.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "📱 Les Groupes Pèlerins",
             [
                 "Groupes de discussion ouverts aux pèlerins (07h00 - 23h00).",
                 "Fermeture nocturne automatique pour préserver le repos.",
                 "Tous les messages analysés en temps réel par le bot.",
                 "Diffusion automatique du récapitulatif chaque soir à 20h10."
             ],
             "GROUPES NUSUK (G1..G5)", c_emerald)

    add_card(s3, Inches(4.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "⚙️ Le Moteur Xhatsapp",
             [
                 "Serveur sécurisé haute performance (Azure Linux).",
                 "Passerelle WhatsApp officielle (OpenWA).",
                 "Base PostgreSQL pour les dictionnaires et historiques.",
                 "Intelligence Artificielle OmniRoute pour les synthèses."
             ],
             "INFRASTRUCTURE SERVEUR", c_dark)

    add_card(s3, Inches(8.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "👑 Le Groupe_admin",
             [
                 "QG opérationnel réservé aux administrateurs.",
                 "Réception immédiate des alertes avec texte intégral.",
                 "Pilotage direct par commandes WhatsApp simples.",
                 "Validation ou refus des cagnottes en 1 clic."
             ],
             "ESPACE MODÉRATEURS", c_gold)

    # -------------------------------------------------------------
    # SLIDE 4 : RÈGLE D'OR N°1 - AGENCES INTERDITES
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    set_bg(s4)
    add_header(s4, "Neutralité Absolue : Suppression Automatique des Agences")
    add_card(s4, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🚫 Suppression Immédiate & Neutralité",
             [
                 "Tolérance zéro sur la citation d'agences de voyage privées.",
                 "82 agences françaises pré-enregistrées dans le dictionnaire.",
                 "Dès qu'un membre cite une agence : le message est SUPPRIMÉ INSTANTANÉMENT pour tous dans le groupe.",
                 "Le bot publie immédiatement un rappel de neutralité :",
                 "  « ⚠️ Pas de citation de nom d'agence dans notre groupe car nous sommes neutres à ce sujet. Merci pour votre compréhension. »"
             ],
             "SUPPRESSION 100% AUTOMATISÉE", c_red)

    add_card(s4, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "📢 Alerte Transparente dans Groupe_admin",
             [
                 "Les modérateurs sont informés instantanément dans Groupe_admin.",
                 "L'alerte contient le NOM DE L'AGENCE détectée.",
                 "Le TEXTE INTÉGRAL du message supprimé est affiché pour vérification des faux-positifs éventuels.",
                 "Mention du groupe source et du nom du pèlerin.",
                 "Aucune intervention requise de votre part, tout est déjà traité."
             ],
             "NOTIFICATION INFORMATIVE", c_emerald)

    # -------------------------------------------------------------
    # SLIDE 5 : DONS, CAGNOTTES & PUBLICITÉS
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    set_bg(s5)
    add_header(s5, "Dons, Cagnottes & Publicités : Contrôle Humain Strict")
    add_card(s5, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "💰 Dons & Cagnottes (Leetchi, Cotizup...)",
             [
                 "Détection des plateformes d'appel aux dons, parrainages et cagnottes.",
                 "Le message N'EST PAS supprimé automatiquement pour éviter les erreurs d'interprétation.",
                 "Une alerte d'arbitrage est envoyée dans Groupe_admin.",
                 "Deux commandes simples pour agir :",
                 "  • SUPPRIMER <CODE> (efface le message du groupe)",
                 "  • IGNORER <CODE> (conserve le message)"
             ],
             "VALIDATION HUMAINE REQUISE", c_gold)

    add_card(s5, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "📢 Placements de Produit & Marques",
             [
                 "Détection des codes promotionnels, réductions et marques commerciales.",
                 "Même mécanisme de sécurité : alerte prioritaire aux modérateurs.",
                 "Possibilité d'enrichir le dictionnaire des marques suspectes à tout moment via l'interface web.",
                 "Contrôle total conservé par l'équipe d'administration."
             ],
             "PROTECTION ANTI-SPAM", c_dark)

    # -------------------------------------------------------------
    # SLIDE 6 : INTERFACE WEB D'ADMINISTRATION
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    set_bg(s6)
    add_header(s6, "Interface Web /admin : Dictionnaires Dynamiques")
    add_card(s6, Inches(0.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "🏢 1. Agences Interdites",
             [
                 "Consultez les 82 agences actives.",
                 "Recherchez instantanément un nom.",
                 "Ajoutez une nouvelle agence en 1 clic.",
                 "Supprimez une agence si nécessaire.",
                 "Prise en compte immédiate par le bot."
             ],
             "SUPPRESSION AUTO", c_emerald)

    add_card(s6, Inches(4.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "💰 2. Dons & Cagnottes",
             [
                 "Enrichissez la liste des plateformes de collecte suspectes.",
                 "Ajout d'adresses URL, noms d'associations ou mots-clés.",
                 "Moteur de normalisation insensible aux accents et majuscules."
             ],
             "ARBITRAGE ADMIN", c_gold)

    add_card(s6, Inches(8.8), Inches(1.8), Inches(3.6), Inches(5.0),
             "📢 3. Pubs & Placements",
             [
                 "Ajoutez des marques, codes promo, services ou influenceurs non autorisés.",
                 "Mise à jour en mémoire vive sans coupure de service ni redémarrage du serveur."
             ],
             "ARBITRAGE ADMIN", c_dark)

    # -------------------------------------------------------------
    # SLIDE 7 : FLASH D'URGENCE & VERROUILLAGE GLOBAL
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    set_bg(s7)
    add_header(s7, "Flash d'Urgence & Verrouillage Global des Groupes")
    add_card(s7, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🚨 Commande FLASH <message>",
             [
                 "Cas d'usage : communication critique (retard vol, alerte météo, consigne officielle Nusuk).",
                 "1. VERROUILLAGE IMMÉDIAT : Le bot fige instantanément tous les groupes en mode « Annonce uniquement ».",
                 "2. DIFFUSION FORMATÉE : Le message est encadré avec l'en-tête officiel haute visibilité :",
                 "   🚨 *FLASH INFO OFFICIEL NUSUK* 🚨",
                 "3. SÉCURITÉ : Les groupes restent verrouillés pour que l'info ne soit pas noyée par les réactions.",
                 "4. Rouvrez les groupes quand vous le souhaitez avec UNBLOCK ALL."
             ],
             "COMMUNICATION PRIORITAIRE", c_red)

    add_card(s7, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🔒 Commandes BLOCK ALL & UNBLOCK ALL",
             [
                 "BLOCK ALL (ou VERROUILLER TOUT) :",
                 "  • Suspend les discussions dans tous les groupes.",
                 "  • Poste un avis de fermeture temporaire discret.",
                 "  • Pratique en cas de débordement ou de crise.",
                 "",
                 "UNBLOCK ALL (ou DEVERROUILLER TOUT) :",
                 "  • Rouvre immédiatement les échanges à tous.",
                 "  • Poste un message de reprise chaleureux."
             ],
             "CONTRÔLE MANUEL TOTAL", c_emerald)

    # -------------------------------------------------------------
    # SLIDE 8 : PROTECTION ANTI-MULTI-GROUPES
    # -------------------------------------------------------------
    s8 = prs.slides.add_slide(blank_layout)
    set_bg(s8)
    add_header(s8, "Protection Anti-Multi-Groupes (Exclusion du 2e Groupe)")
    add_card(s8, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🚫 Le Problème : La Saturation des Groupes",
             [
                 "Beaucoup de pèlerins rejoignent 2, 3 ou 4 groupes à la fois.",
                 "Conséquence : les groupes affichent « Complet » et de nouveaux pèlerins ne peuvent plus entrer.",
                 "Or, l'information et le récapitulatif sont strictement IDENTIQUES dans tous nos groupes !",
                 "Une présence dans un seul groupe est amplement suffisante."
             ],
             "CONSTAT", c_dark)

    add_card(s8, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "⚡ L'Automatisme Anti-Doublon",
             [
                 "1. Dès qu'un pèlerin rejoint un 2e groupe : le bot vérifie les autres groupes.",
                 "2. EXCLUSION DU 2e GROUPE : Le membre est automatiquement retiré du nouveau groupe.",
                 "3. MP PÉDAGOGIQUE : Il reçoit un message privé bienveillant lui expliquant que les places sont limitées et que son premier groupe lui suffit largement.",
                 "4. ALERTE ADMIN : Les modérateurs reçoivent une notification de confirmation dans Groupe_admin.",
                 "⭐️ MODÉRATEURS & ADMINS TOTALEMENT EXEMPTÉS !"
             ],
             "AUTOMATISME ACTIF", c_emerald)

    # -------------------------------------------------------------
    # SLIDE 9 : AUDIT DES MEMBRES EN DOUBLON
    # -------------------------------------------------------------
    s9 = prs.slides.add_slide(blank_layout)
    set_bg(s9)
    add_header(s9, "Audit des Doublons Existants : Commande DOUBLONS")
    add_card(s9, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🔍 Commande DOUBLONS dans Groupe_admin",
             [
                 "Tapez simplement DOUBLONS ou AUDIT DOUBLONS.",
                 "Le bot scanne la totalité des membres de tous les groupes surveillés.",
                 "Il exclut automatiquement tous les comptes administrateurs et modérateurs.",
                 "Il dresse l'inventaire des membres présents dans 2 groupes ou plus.",
                 "Génération instantanée d'un compte-rendu clair et chiffré."
             ],
             "AUDIT À LA DEMANDE", c_gold)

    add_card(s9, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "📊 Exemple de Rapport Reçu",
             [
                 "📊 *AUDIT DES MEMBRES EN DOUBLON*",
                 "───────────────────────────",
                 "🔍 Groupes analysés : 5",
                 "👥 Pèlerins distincts : 4 850",
                 "⚠️ Membres en doublon : 8 (hors administrateurs)",
                 "",
                 "1. +33612345678 : présent dans [Groupe_01, Groupe_02]",
                 "2. +33798765432 : présent dans [Groupe_01, Groupe_03]",
                 "...",
                 "ℹ️ Permet de contacter ou retirer manuellement les anciens doublons."
             ],
             "RAPPORT TRANSMIS AUX ADMINS", c_emerald)

    # -------------------------------------------------------------
    # SLIDE 10 : ONBOARDING EN MESSAGE PRIVÉ (DM)
    # -------------------------------------------------------------
    s10 = prs.slides.add_slide(blank_layout)
    set_bg(s10)
    add_header(s10, "Accueil & Onboarding Automatique en Message Privé")
    add_card(s10, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🤝 Accueil Chaleureux & Non Intrusif",
             [
                 "Envoyé automatiquement en MESSAGE PRIVÉ (DM) dès qu'un pèlerin intègre son premier groupe.",
                 "Ne pollue pas le fil de discussion public du groupe.",
                 "Garantit que chaque nouveau membre prend connaissance des règles dès la première minute.",
                 "Ton fraternel, respectueux et structuré."
             ],
             "1ÈRE CONNEXION", c_emerald)

    add_card(s10, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "📜 Les 5 Règles d'Or Transmises",
             [
                 "1️⃣ Neutralité absolue : Pas de citation d'agences.",
                 "2️⃣ Zéro pub ni collecte : Pas de vente ni cagnottes.",
                 "3️⃣ Fraternité & Sérénité : Respect, pas de polémique.",
                 "4️⃣ Fermeture nocturne : Pause de 23h00 à 07h00.",
                 "5️⃣ Récapitulatif quotidien : Bilan chaque soir à 20h10.",
                 "",
                 "📌 Rappel clé : Un seul groupe est suffisant."
             ],
             "CONTENU DU MESSAGE PRIVÉ", c_gold)

    # -------------------------------------------------------------
    # SLIDE 11 : LA SENTINELLE PANIQUE & RUMEURS
    # -------------------------------------------------------------
    s11 = prs.slides.add_slide(blank_layout)
    set_bg(s11)
    add_header(s11, "Sentinelle Panique & Rumeurs : Alerte Précoce")
    add_card(s11, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "⚡ Détection des Mots d'Angoisse",
             [
                 "Surveillance continue des discussions publiques.",
                 "Détecte les mots de panique : arnaque, faux billet, faux visa, bloqué à l'aéroport, compte piraté, plainte, police, scandale...",
                 "Le message N'EST PAS CENSURÉ ni supprimé (pour ne pas frustrer un pèlerin inquiet).",
                 "Objectif : Donner aux administrateurs une avance précieuse pour désamorcer la rumeur."
             ],
             "VEILLE EN TEMPS RÉEL", c_red)

    add_card(s11, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🚨 Alerte Immédiate dans Groupe_admin",
             [
                 "🚨 *SENTINELLE : ALERTE PANIQUE / RUMEUR*",
                 "📍 Groupe : Groupe_01",
                 "👤 Auteur : Nom (+336...)",
                 "⚠️ Termes détectés : arnaque, faux billet",
                 "💬 Message :",
                 "  « Est-ce vrai qu'il y a une arnaque sur les billets pour Médine ? »",
                 "",
                 "👉 Vous pouvez intervenir immédiatement avec un message rassurant et vérifié."
             ],
             "DISCRÈTE & EFFICACE", c_emerald)

    # -------------------------------------------------------------
    # SLIDE 12 : LE RÉCAPITULATIF QUOTIDIEN DE 20H10
    # -------------------------------------------------------------
    s12 = prs.slides.add_slide(blank_layout)
    set_bg(s12)
    add_header(s12, "Le Récapitulatif Quotidien de 20h10 (IA OmniRoute)")
    add_card(s12, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "📝 Synthèse Intelligente de la Journée",
             [
                 "Chaque soir à 20h10 (heure de Paris).",
                 "Le bot analyse l'ensemble des échanges de la journée.",
                 "L'intelligence artificielle filtre le bruit et extrait les informations utiles :",
                 "  • Démarches administratives Nusuk validées",
                 "  • Conseils logistiques (vols, hôtels, forfaits)",
                 "  • Réponses aux questions fréquentes des pèlerins",
                 "Un texte clair, structuré et agréable à lire."
             ],
             "SYNTHÈSE AUTOMATIQUE", c_emerald)

    add_card(s12, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🛡️ Validation Humaine Avant Diffusion",
             [
                 "1. L'aperçu complet arrive d'abord dans Groupe_admin avec un code (ex: GO RECAP ABC123).",
                 "2. Les modérateurs relisent le récapitulatif.",
                 "3. Validation : tapez GO RECAP ABC123 pour diffuser dans tous les groupes autorisés.",
                 "4. Annulation : tapez ANNULER RECAP ABC123 si vous ne souhaitez pas publier.",
                 "Rien n'est publié sans votre feu vert !"
             ],
             "CONTRÔLE ADMINISTRATEUR", c_gold)

    # -------------------------------------------------------------
    # SLIDE 13 : FICHE MÉMO DES COMMANDES ADMINS
    # -------------------------------------------------------------
    s13 = prs.slides.add_slide(blank_layout)
    set_bg(s13)
    add_header(s13, "Fiche Mémo : Vos Commandes dans Groupe_admin")
    add_card(s13, Inches(0.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "🕹️ Pilotage & Urgence",
             [
                 "BLOCK ALL : Verrouille tous les groupes (mode annonce).",
                 "UNBLOCK ALL : Déverrouille et rouvre tous les groupes.",
                 "FLASH <texte> : Diffuse une alerte urgente et verrouille les groupes.",
                 "DOUBLONS : Lance l'audit des membres présents dans plusieurs groupes (hors modérateurs)."
             ],
             "GESTION DES GROUPES", c_emerald)

    add_card(s13, Inches(6.8), Inches(1.8), Inches(5.6), Inches(5.0),
             "⚖️ Modération & Diffusion",
             [
                 "SUPPRIMER <CODE> : Supprime un message signalé (don/pub).",
                 "IGNORER <CODE> : Conserve un message signalé.",
                 "COMMUNIQUE : Crée un brouillon de message à diffuser.",
                 "GO COMMUNIQUE <CODE> : Diffuse le communiqué.",
                 "GO RECAP <CODE> : Diffuse le récapitulatif quotidien de 20h10."
             ],
             "MODÉRATION AU CAS PAR CAS", c_gold)

    # -------------------------------------------------------------
    # SLIDE 14 : CONCLUSION & ENGAGEMENT
    # -------------------------------------------------------------
    s14 = prs.slides.add_slide(blank_layout)
    bg14 = s14.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg14.fill.solid()
    bg14.fill.fore_color.rgb = c_emerald
    bg14.line.fill.background()

    tb14 = s14.shapes.add_textbox(Inches(1.5), Inches(1.5), Inches(10.3), Inches(4.5))
    tf14 = tb14.text_frame
    tf14.word_wrap = True

    p = tf14.paragraphs[0]
    p.text = "NOTRE MISSION COMMUNE"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = c_gold
    p.space_after = Pt(14)

    p = tf14.add_paragraph()
    p.text = "Une Communauté Sereine, Fraternelle et Neutre"
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = c_white
    p.space_after = Pt(20)

    p = tf14.add_paragraph()
    p.text = "Grâce à cette boîte à outils complète, l'équipe d'administration gagne du temps, évite la saturation des groupes et protège les pèlerins contre les arnaques et la désinformation."
    p.font.size = Pt(16)
    p.font.color.rgb = RGBColor(226, 232, 240)
    p.space_after = Pt(24)

    p = tf14.add_paragraph()
    p.text = "Qu'Allah récompense vos efforts au service des invités du Très Miséricordieux ! 🕋🤲"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = c_gold

    prs.save(output_path)
    print(f"Presentation saved successfully to {output_path}")

if __name__ == '__main__':
    target = os.path.abspath("Presentation_Admins_Nusuk_Hajj_2026.pptx")
    create_deck(target)
