# Cahier des charges — Application Nomad Club

Synthèse fonctionnelle à destination du développeur (version reçue le 2 novembre 2026).

## 1. Objectif du projet

Développer une application web mobile pour le Nomad Club, accessible depuis un smartphone, qui centralise la vie de la communauté, les événements, la messagerie, les avantages partenaires, les ressources payantes et les opportunités commerciales entre membres.

L'application devra également permettre au Nomad Club de gérer ses adhérentes, ses partenaires et ses professionnels à travers un véritable CRM.

## 2. Fonctionnalités principales

- Actualités et événements : publications, calendrier, inscriptions et notifications.
- Messagerie : chat commun, messages privés, groupes thématiques et modération par mots-clés.
- Carte interactive : géolocalisation des membres avec leur consentement et localisation des établissements proposant des offres partenaires.
- Annuaire des membres : consultation et recherche des profils.
- Offres partenaires : réductions et avantages exclusifs, avec fiches établissements et statistiques d'utilisation.
- Carnet d'adresses : référencement payant de professionnels par abonnement mensuel, qu'ils proposent ou non des réductions.
- Ressources digitales : boutique de guides et produits numériques avec paiement et accès automatique après achat.
- Dashboard membre : espace personnalisé avec widgets obligatoires et facultatifs, notamment actualités, événements, météo, agenda et heures de prière.
- Parrainage : codes personnels, suivi des inscriptions et attribution de récompenses.
- Espace Business : déclaration des deals entre membres, attribution de points et suivi des retombées commerciales, sans commission prélevée par le club.

## 3. Abonnements, paiements et contrats

- Adhésion annuelle des membres avec possibilité de paiement en plusieurs fois.
- Abonnements mensuels pour les professionnels souhaitant figurer dans le carnet d'adresses.
- Génération automatique des contrats après souscription, avec acceptation ou signature électronique.
- Envoi des contrats en PDF par email et mise à disposition dans les espaces utilisateurs.
- Historique des paiements, contrats, échéances et renouvellements.
- Contrats distincts pour les adhérentes et les partenaires.

Les conditions contractuelles devront être validées juridiquement.

## 4. Les différents espaces et dashboards

L'application devra comporter plusieurs espaces distincts, reliés à une base de données commune.

- Dashboard membre : profil, adhésion, événements, messagerie, offres, ressources, parrainages et deals.
- Dashboard administrateur : gestion globale de l'application, des membres, des événements, des paiements, des partenaires et des contenus.
- Dashboard partenaire : gestion des offres proposées aux membres, des contrats et des statistiques d'utilisation.
- Dashboard professionnel du carnet d'adresses : gestion de la fiche, de l'abonnement et des statistiques de visibilité.
- CRM du Nomad Club : centralisation des contacts, prospects, adhérentes, anciennes membres et professionnels, avec suivi commercial et administratif.

Un professionnel pourra disposer des deux espaces professionnels s'il est à la fois référencé dans le carnet d'adresses et partenaire proposant des réductions.

## 5. CRM et pilotage de l'activité

Le CRM devra être un véritable outil de gestion, et pas seulement un tableau de statistiques. Il devra notamment permettre de :

- Centraliser les fiches et coordonnées des contacts.
- Suivre les prospects, les demandes d'informations et les relances.
- Gérer les adhésions, échéances, renouvellements et paiements.
- Suivre les contrats et les relations commerciales avec les professionnels.
- Segmenter les contacts et organiser des actions de suivi.
- Consulter les statistiques de conversion, de renouvellement et de revenus.
- Mesurer les retombées commerciales du réseau grâce aux deals déclarés par les membres.

## 6. Administration et sécurité

- Gestion des rôles et des autorisations selon le profil : administratrice, modératrice, membre, partenaire ou professionnel.
- Accès limité aux données nécessaires à chaque utilisateur.
- Gestion des mots-clés et des signalements dans la messagerie.
- Protection des données personnelles et contrôle du partage de géolocalisation.
- Sauvegardes, sécurité des comptes et historique des opérations importantes.

## 7. Plateforme et évolution

La première version sera une application web mobile, accessible depuis le navigateur d'un smartphone, sans développement initial d'applications natives iOS et Android.

Le développeur devra prévoir une architecture évolutive, une interface d'administration adaptée à l'ordinateur et la possibilité de développer ultérieurement des applications natives.
