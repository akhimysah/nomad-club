# Rapport d'accessibilité

Vague 2, chantier « Inscription et lancement » — 2 novembre 2026. Référentiel visé : **WCAG 2.2 niveau AA** (équivalent RGAA). Périmètre : pages publiques, parcours d'inscription et d'onboarding, candidature, invitation, pages d'erreur et de statut, écrans fondatrices ajoutés (Candidatures, invitations dans Rôles et accès).

## Méthode

- **Contrôle automatique du HTML rendu** : `scripts/a11y-statique.mjs` sur 20 écrans (visiteuse, compte gratuit, membre, admin), appli construite en production et branchée en mode réel. Vérifie : `lang="fr"`, un seul `h1` et aucun saut de niveau de titre, `alt` sur chaque image, étiquette pour chaque champ (`<label for>`, champ enveloppé ou `aria-label`), nom accessible des boutons et des liens.
- **Contrastes** calculés sur les jetons de couleur de `globals.css` (formule WCAG).
- **Relecture du code** des nouveaux composants : clavier, focus, messages d'état, mouvements.
- Pas d'outil de navigateur (axe, Lighthouse) dans ce chantier : un essai au lecteur d'écran reste à faire (voir « À faire »).

## Résultats

### Contrastes (fond `#0b0b0b`, cartes `#111` / `#181818`)

| Texte | Rapport | AA (4,5:1) |
|---|---|---|
| Texte principal `#f3f3f3` | 17,7:1 | ✓ |
| Texte secondaire `#dedede` | 14,6:1 | ✓ |
| Texte atténué `#c3c3c3` sur carte `#181818` | 10,1:1 | ✓ |
| Bouton doré : texte `#111` sur `#d5d5d5` | 12,9:1 | ✓ |
| Image de partage, sous-titre `#9a9a9a` | 7,0:1 | ✓ |

La charte noir et blanc dépasse largement le niveau AAA (7:1) pour tous les textes.

### Contrôle automatique

20 écrans, **0 problème** après correction. Constat corrigé : `/rendez-vous`, `/club` et `/formules` n'avaient **aucun titre de niveau 1** (la section reprise de l'accueil commençait en `h2`). Les sections acceptent maintenant `page` : quand elles sont la page entière, leur surtitre (« Agenda », « Déjà vécu au club », « Formules ») devient le `h1`, le titre reste un `h2` et les cartes des `h3`, sans saut de niveau (`SecHead` dans `src/components/visit/sections.tsx`). Sur l'accueil, rien ne change (un seul `h1`, celui du haut de page).

### Formulaires (inscription, candidature, fiche, invitation)

- Chaque champ a une étiquette visible reliée (`<label for>`), les champs facultatifs le disent dans l'étiquette, les `autocomplete` sont renseignés (e-mail, prénom, nom, téléphone, pays, métier, entreprise) — critère 1.3.5.
- Erreurs : message en clair dans une zone `role="alert"`, le champ fautif est encadré (`.field.err`) **et** relié au message par `aria-describedby` ; la couleur n'est jamais le seul indice (3.3.1, 1.4.1).
- Confirmations (`role="status"`) : lien envoyé, candidature envoyée, décision enregistrée, invitation créée.
- Le choix « compte gratuit / demander l'adhésion » est un vrai groupe de boutons radio (`fieldset` + `legend`), navigable aux flèches ; le focus est visible sur la carte choisie.
- La case CGU est une vraie case à cocher, avec les liens vers les textes (ouverts dans un nouvel onglet).
- Le formulaire d'inscription fonctionne sans JavaScript (server action) ; l'onboarding aussi (boutons « Continuer », « Passer cette étape », « Plus tard » dans un formulaire).

### Navigation et structure

- Étapes de l'onboarding : `nav` étiquetée « Étapes de la bienvenue », liste ordonnée, `aria-current="step"` sur l'étape en cours, texte « étape 2 sur 4 » en clair.
- Fondatrices : le mode d'adhésion est un `radiogroup` (`aria-checked`) ; chaque candidature est un `article` titré ; tableaux avec `th scope="col"`, légende de tableau, colonne d'action nommée pour les lecteurs d'écran (`.lc-sr`).
- Pages d'erreur, maintenance, statut : une seule région nommée, un `h1`, des liens de sortie (accueil, agenda, état du service). Le code d'erreur est écrit, pas seulement suggéré par la couleur ; sur `/statut` chaque pastille de couleur est doublée d'un texte (« Joignable », « Désactivée »).
- Focus visible partout (`:focus-visible`, contour de 2 px), y compris sur les cartes radio et les liens-boutons.
- Cibles tactiles : boutons 42 à 58 px de haut, champs 58 px ; les plus petites (liens « Passer cette étape », onglets d'étapes) dépassent 24 × 24 px (critère 2.5.8).
- Mouvements : `prefers-reduced-motion` coupe les animations de l'appli ; les nouveaux écrans n'en ajoutent pas.
- Photo de profil : le champ fichier est caché mais déclenché par un vrai bouton (« Ajouter une photo »), la photo a un texte alternatif, les initiales de repli sont `aria-hidden`.

## Limites et à faire

- [ ] Essai au lecteur d'écran sur téléphone (VoiceOver iPhone, TalkBack Android) du parcours complet : inscription → lien → onboarding → candidature → paiement.
- [ ] Zoom à 200 % et largeur 320 px : la mise en page est fluide (grilles qui passent sur une colonne sous 560 px) mais n'a pas été vérifiée écran par écran.
- [ ] Les écrans antérieurs à la vague 2 (espace membre, CRM, espaces partenaire et pro) n'ont été contrôlés que par le parcours sans erreur (`scripts/parcours-reel.mjs`), pas par le contrôle d'accessibilité : à étendre en ajoutant leurs adresses à `scripts/a11y-statique.mjs`.
- [ ] Déclaration d'accessibilité (obligatoire pour certains organismes, recommandée ici) : à rédiger après l'essai au lecteur d'écran.
