# Nomad Club : cahier des charges commun aux 5 styles

On refait l'appli Nomad Club (club de femmes et entrepreneuses expatriées à Marrakech, fondé par Julia et Nora) en 5 versions dont la STRUCTURE, la navigation, les gestes et la mise en page sont radicalement différents (pas juste une palette). Le ton : ergonomique (actions évidentes, grosses cibles tactiles, une action principale par écran) ET un peu "wtf" (surprises, easter eggs, animations qui font sourire).

Toute la copie est en français, tutoiement, phrases courtes et simples. Pas de tirets cadratins en aparté, pas de "pas X mais Y". Paiements et envois simulés : le dire discrètement ("paiement simulé", "rien ne part vraiment").

## Contrat technique (obligatoire)

- UN seul fichier HTML autonome. Le fichier est enveloppé à la publication dans `<!doctype html><html><head><meta charset utf-8><meta viewport…></head><body>` : n'écris donc PAS `<!doctype>`, `<html>`, `<head>`, `<body>`. Commence le fichier par `<title>…</title>` puis `<link>` Google Fonts puis `<style>`, puis le HTML, puis `<script>`.
- Polices : uniquement Google Fonts (fonts.googleapis.com), avec une vraie pile de secours. Choisis des polices propres à ton style ; évite Inter, Space Grotesk, et les polices déjà utilisées dans les versions précédentes (Bagel Fat One, Figtree, Martian Mono, Gloock, Nunito Sans, Bungee, Chakra Petch, DM Serif Display, Karla, Rubik Mono One, Manrope, Permanent Marker, Libre Franklin).
- Aucune image externe (bloquée). Les "photos" se font en CSS (dégradés, formes), SVG inline, canvas ou emoji. Indique en légende ce que la photo représente ("Photo : Fer7, table face au golf") comme l'original.
- Bibliothèques : idéalement aucune. Si vraiment utile, uniquement un script UMD depuis https://cdnjs.cloudflare.com/ajax/libs/<lib>/<version exacte>/… Pas de fetch réseau.
- Interdits : `alert()`, `confirm()`, `prompt()`, `window.print()`, `<a download>`, iframes, `mailto:`/`tel:` comme seule voie. Formulaires : `preventDefault()`, confirmation dans la page (toast, écran de succès).
- `localStorage` seulement pour du confort (onglet retenu), toujours dans try/catch, la page doit marcher sans.
- Responsive : doit marcher à 375–400 px de large (téléphone) ET sur ordinateur (1280 px). Jamais de scroll horizontal de la page. Gouttière latérale ≥ 16 px. Sur ordinateur, tu peux centrer un cadre de téléphone ou faire une vraie mise en page desktop, au choix du style.
- Utilise `height:100%` sur html/body plutôt que `100vh` pour une appli plein écran.
- Couleurs en tokens CSS sur `:root`. Ton style peut assumer un seul thème (clair OU sombre) : dans ce cas définis explicitement `body{background;color}` et `color-scheme`.
- Accessibilité de base : focus visible, boutons = `<button>`, `prefers-reduced-motion` respecté, ids stables sur les champs.
- L'écran d'arrivée doit être rempli et beau dès le chargement (pas d'écran vide, rien à opacity:0 en attente).
- Vérifie ta syntaxe JS avant de finir : extrais le contenu de ta balise `<script>` dans un fichier du scratchpad et lance `node --check`. N'utilise PAS le navigateur intégré (d'autres agents travaillent en parallèle).

## Sélecteur d'espace (obligatoire, dans toutes les versions)

Un sélecteur toujours accessible pour basculer entre les 3 espaces, comme dans l'original : **Compte gratuit** (visiteuse), **Membre** (Inès Laurent, formule Membre), **Fondatrices** (Julia et Nora). Intègre-le dans la logique du style (ex. : un onglet, un switch, un contact, une icône de bureau…), mais il doit être évident. Bandeau discret "Aperçu · données d'exemple".

## Contenu à couvrir ENTIÈREMENT (données d'exemple)

Date du jour de la démo : mercredi 14 octobre 2026 (tu peux utiliser la vraie date pour les comptes à rebours).

### Espace Compte gratuit (visiteuse)
- Accroche : "Club femmes & entrepreneuses à Marrakech". Titre : "Le plus difficile n'est pas de changer de pays. C'est de reconstruire un cercle." Texte : le Nomad Club réunit des femmes de tous horizons qui ont choisi de construire leur réseau, créer de vraies amitiés et vivre pleinement leur aventure à Marrakech. Boutons "Voir les prochains rendez-vous" et "Adhérer".
- Légendes photo : "Iftar du club à la Villa Yemna, mars 2026" · "Lancement de saison à La Terraza, septembre 2026".
- Prochains rendez-vous (ouverts à toutes au tarif public avec un compte gratuit ; les adhérentes paient moins ; ceux marqués Premium sont offerts aux Premium) :
  - À LA UNE : Lunch Raffiné & Networking, lundi 26 octobre, 12 h – 15 h, Fer7, Golf, route d'Amizmiz. "Une table face aux greens et aux palmiers, des saveurs asiatiques à partager, et des rencontres qui comptent." 1 place restante sur 12. 60 $ public, 50 $ adhérentes. Photo : Fer7, table face au golf.
  - BODY Expérience, lundi 19 octobre, 14 h – 18 h, Body Agency. Réservé Premium, offert Premium. 4 places restantes (11/15).
  - Tournoi de padel féminin, samedi 7 novembre, 9 h 30, Urban Padel. 30 $ (25 $ adhérentes). Complet (8/8), liste d'attente (3 en attente).
  - Dîner privé, jeudi 19 novembre, 19 h 30, Terrajana. 90 $ (75 $ adhérentes). 16 places restantes (4/20).
- Réservation compte gratuit : prénom + WhatsApp suffisent, le compte se crée à la première réservation, paiement en ligne (simulé), billet envoyé sur WhatsApp. Lien "Voir l'adhésion · tarif membre 50 $".
- "Déjà vécu au club" (les derniers rendez-vous, avec celles qui y étaient) : Tournoi de padel féminin, Urban Padel, août 2026, 15 participantes · Chill & Connect, Palmeraie, juin 2026, 14 participantes · Brunch de fin d'année, Chonchon & Chocolat, décembre 2025, 16 participantes. Légendes : "Lunch au Fer7, juin 2025" · "Brunch du club, octobre 2025".
- "Comment se passe un lunch" : Une dizaine de femmes, une belle table, et un fil qui aide à se parler vraiment. Celles qui arrivent seules ne le restent pas longtemps.
  1. Cercle d'ouverture : chacune se présente en une phrase : prénom, métier, depuis quand à Marrakech.
  2. Speed networking en duo : huit minutes à deux, puis on change. Pas de badge, pas de pitch forcé.
  3. Boîte à questions : les questions qu'on n'ose pas poser : visa, banque, école, clientèle.
  4. Outils concrets : chacune repart avec trois contacts et une adresse à tester.
- Citation : « C'est plus qu'un club. C'est une communauté en pleine construction, humaine, chaleureuse, sans prétention mais avec beaucoup d'âme. » Nora, cofondatrice.
- Formules (prix par an en dollars US) :
  - Compte gratuit 0 $ : les actualités, l'agenda, la discussion du club et l'assistant. Réservation et paiement de ta place au tarif public, billet sur WhatsApp.
  - Membre 670 $ / an : tout le compte gratuit + tarif membre aux rendez-vous ouverts (50 $ au lieu de 60 $ pour un lunch) + annuaire des membres et messages privés entre membres + offres des partenaires et carte de membre. Les rendez-vous Premium ne sont pas inclus.
  - Premium 1 250 $ / an : tout Membre + rendez-vous Premium offerts (prochain : BODY Expérience, le 19 octobre) + une invitée offerte par trimestre + priorité sur les dîners à places limitées.

### Espace Membre (Inès Laurent, initiales IL)
- Accueil : "Bonjour Inès", prochain rendez-vous réservé : Lunch Raffiné & Networking, lundi 26 octobre, 12 h, dans 12 jours, Fer7, bouton "Mon billet" (billet avec QR, simulé). "Bientôt au club" (BODY Expérience 19 oct Réservé Premium 4 places ; Padel 7 nov 25 $ complet liste d'attente ; Dîner privé 19 nov 75 $ 16 places).
- Adhésion : formule Membre, 670 $ par an, se termine le 18 novembre 2026 (dans 35 jours), bouton Renouveler, "Ma carte et mon adhésion" (carte de membre numérique), possibilité de passer Premium.
- Salon (discussion du club, salon "Général") : Yasmine Tazi 9 h 52 : « Thinking, Fast and Slow », de Kahneman. Je peux prêter mon exemplaire. · Julia 10 h 05 : Rappel : BODY Expérience lundi 19, de 14 h à 18 h. Réservé aux Premium, il reste 4 places. On doit pouvoir écrire (réponses simulées).
- Cercle (annuaire des membres + messages privés). Membres d'exemple : Yasmine Tazi (avocate d'affaires, Premium), Julia (cofondatrice), Nora (cofondatrice), Salma Alaoui (Premium), Chloé Martin (Membre), Nadia Kettani, Lou Garnier, Maya Benkirane, Leïla Benjelloun, Emma Schneider, Capucine Dubois, Nawal Garcia, Justine Rochette. Invente métiers/nationalités plausibles. 61 adhérentes actives, dont 24 Premium.
- Carnet d'adresses ("Des lieux où le club est allé. Testés, pas sponsorisés." Filtres : Tout, Manger, Sortir, Bien-être et sport, En famille) :
  - Fer7 · Restaurant · Golf, route d'Amizmiz · Izakaya face aux greens. Notre lunch du lundi. · Recommandé par Julia · Le club y était : Lunch Raffiné & Networking, 26 janvier 2026.
  - Maison Amaj · Pâtisserie, petit-déjeuner · Guéliz · L'adresse de Mounir El Fahsi, vainqueur du Meilleur Pâtissier. · Nora · Petit-déjeuner, édition mixte, 4 août 2026.
  - Urban Padel · Sport · Targa · Nos tournois féminins. Réserve le terrain 3 jours avant. · Julia · Tournoi de padel féminin, 8 août 2026.
  - La Terraza · Rooftop · Guéliz · Le toit du lancement de saison. Coucher de soleil sur l'Atlas. · Nora · Lancement de la saison, 24 septembre 2026.
  - Villa Yemna · Lieu de réception · Palmeraie · Notre premier iftar, une table de trente. · Nora · Iftar du Nomad Club, 13 mars 2026.
  - Terrajana · Dîner, jardin · Route de l'Ourika · Grande table dans le jardin, idéal pour 20 personnes. · Julia · Dîner d'exception, 4 mai 2026.
  - Bloom House · Bien-être · Guéliz · Conférences et ateliers, une terrasse très calme. · Nora.
  - Chonchon & Chocolat · Brunch · Guéliz · Grande tablée, parfait pour un brunch à quinze. · Julia · Brunch de fin d'année, 14 décembre 2025.
  - The Ranch Morocco · Famille · Route de l'Ourika · Ferme pédagogique et poneys, les enfants adorent. · Nora.
  - AVABAY · Brunch, lieu d'événement · Palmeraie · Un lieu qui invite à ralentir. Notre brunch neurosciences. · Julia · Brunch Networking & Neurosciences, 11 octobre 2026.
- Assistant ("Une question ?" ex. « Une adresse pour un brunch à Guéliz ? ») : réponses simulées utiles (brunch Guéliz → Chonchon & Chocolat / Maison Amaj ; visa ; banque ; école ; padel…), qui s'appuient sur le carnet et l'agenda.
- Offres partenaires (invente 2–3 : ex. -15 % chez Bloom House, café offert chez Maison Amaj).

### Espace Fondatrices (Julia et Nora, initiales J et N)
- "Données au mercredi 14 octobre". Bouton "Nouvel événement" (formulaire simulé).
- Résumé : 19 actions à traiter, dont 5 urgentes : 3 virements à valider, 6 renouvellements à relancer, 3 adhésions échues à relancer, 2 rendez-vous avec billets impayés (3 billets, 125 $), 3 comptes gratuits à faire adhérer, 2 brouillons à publier.
- Chiffres : 61 adhérentes actives (+28 en 12 mois, 24 Premium, 2 adhésions en attente) · Encaissé au 14 octobre : 1 385 $ (septembre au 14 : 8 350 $) · À renouveler sous 30 j : 6 adhésions, 5 760 $ en jeu, 2 relancées.
- Valider 3 virements (1 970 $) : Nadia Kettani, billet Lunch Raffiné & Networking, déclaré le 12 oct, 50 $ · Lou Garnier, adhésion Membre, déclaré le 11 oct, 670 $ · Maya Benkirane, adhésion Premium, déclaré le 9 oct, 1 250 $. Bouton Valider + Tout valider. "Vérifiez chaque virement sur le compte avant de valider."
- Relancer (14 relances, 7 895 $) : Chloé Martin, échéance dans 5 j, Membre, 19 oct, relancée le 19 sept, 670 $ · Lunch du 26 oct : 2 impayées (Nawal Garcia, Capucine Dubois), 100 $ · Salma Alaoui, échéance dans 10 j, Premium, 24 oct, relancée le 24 sept, 1 250 $ · Yasmine Tazi, échéance dans 19 j, Premium, 2 nov, jamais relancée, 1 250 $ · "10 autres à relancer".
- Publier 2 brouillons : « Family Day », dimanche 29 novembre, The Ranch Morocco, 30 places · « Chill & Connect, édition d'hiver », samedi 12 décembre, lieu à confirmer avant publication.
- Remplissage des événements : BODY Expérience 11/15 · Lunch Fer7 11/12 · Padel 8/8 complet, 3 en liste d'attente · Dîner privé 4/20 · Family Day brouillon. (payées ou offertes vs en attente de paiement)
- Relances automatiques : envoyées 30 j : 4 messages ; sans réponse : 4 personnes (Leïla Benjelloun, adhésion échue, il y a 13 j · Salma Alaoui, renouvellement, il y a 20 j · Emma Schneider, adhésion échue, il y a 23 j · Chloé Martin, renouvellement, il y a 25 j) ; prévues 14 j : 17 oct Salma Alaoui (une semaine avant) · 18 oct Chloé Martin (la veille) · 19 oct Inès Laurent (un mois avant) · 23 oct Salma Alaoui (la veille) · 26 oct Justine Rochette (un mois avant). Règle : un mois, une semaine et la veille de l'échéance ; échue ou billet impayé sans réponse : J+3 puis J+7 ; jamais deux messages le même jour à la même personne.
- Encaissements 12 derniers mois : 60 845 $ au total (adhésions + billets), mois nov → oct (oct en cours). Exemple de répartition mensuelle (k$) : nov 3,9 · déc 5,2 · janv 7,8 · févr 4,1 · mars 6,3 · avr 4,6 · mai 5,0 · juin 4,4 · juil 3,2 · août 4,6 · sept 8,35 · oct 1,385 (le total doit faire ≈ 60 845 $ ; ajuste). Graphique dessiné à l'échelle.
- Échéances d'adhésion à venir (nombre par mois) : oct 3 · nov 6 · déc 4 · janv 7 · févr 2 · mars 5.
- Les boutons Valider / Relancer / Publier fonctionnent (simulé) : l'élément passe à l'état traité, les compteurs baissent.

## Livrable
Écris ton fichier à l'emplacement exact indiqué dans ta mission, puis réponds avec : le chemin, 3 lignes sur la direction (navigation, polices, idée wtf), et toute limite connue. Pas de publication, pas de navigateur.
