/**
 * Vague 2 · Contrats — textes initiaux (version 1) des trois modèles.
 *
 * BROUILLONS : rédigés pour l'application, à faire relire, compléter et valider par un juriste avant toute
 * mise en production. Les mentions entre crochets ([RAISON SOCIALE]…) sont à compléter par le club.
 *
 * Syntaxe (Markdown simplifié, voir render.ts) :
 * - `# Titre`, `## Article`, `### Sous-titre`, paragraphes séparés par une ligne vide, listes `- `, gras `**…**` ;
 * - `> texte` : encadré visible dans le contrat ;
 * - `>> texte` : NOTE INTERNE, visible seulement en back-office (avertissement, variantes Maroc / France) ;
 *   elle est retirée du contrat généré et du PDF ;
 * - `{{variable}}` : remplie à la génération (liste dans CONTRACT_VARIABLES).
 *
 * Ces textes sont aussi insérés par la migration 0010_contrats.sql (bloc généré par
 * `node scripts/contrats-templates-sql.mjs`) ; `npm run test:sql` vérifie que les deux sont identiques.
 * Les versions suivantes se créent depuis le back-office (/fondatrices/contrats/modeles).
 */
import type { ContractKind } from "./types.ts";

export const DRAFT_NOTICE = "BROUILLON — à faire valider par un juriste";

/** Variables disponibles dans les modèles, avec leur description (affichée dans l'éditeur de modèles). */
export const CONTRACT_VARIABLES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "club.nom", label: "Nom d'usage du club (Nomad Club)" },
  { key: "contrat.numero", label: "Numéro unique du contrat" },
  { key: "contrat.date", label: "Date de génération (en toutes lettres)" },
  { key: "modele.version", label: "Version du modèle" },
  { key: "signataire.nom", label: "Prénom et nom de la signataire" },
  { key: "signataire.email", label: "E-mail de la signataire" },
  { key: "signataire.telephone", label: "Téléphone / WhatsApp de la signataire" },
  { key: "signataire.carte", label: "Numéro de carte de membre" },
  { key: "etablissement.nom", label: "Nom de l'établissement (partenaire, pro)" },
  { key: "etablissement.adresse", label: "Adresse de l'établissement" },
  { key: "etablissement.categorie", label: "Activité de l'établissement" },
  { key: "formule.nom", label: "Nom de la formule (Membre, Premium, Essentiel…)" },
  { key: "formule.avantages", label: "Ce que comprend la formule" },
  { key: "montant.total", label: "Montant total (adhésion) ou mensuel (pro), avec la devise" },
  { key: "montant.mensuel", label: "Prix mensuel (pro)" },
  { key: "montant.devise", label: "Code de la devise (USD, MAD, EUR)" },
  { key: "echeancier.nombre", label: "Nombre d'échéances, en toutes lettres" },
  { key: "echeancier.detail", label: "Liste des échéances (dates et montants)" },
  { key: "dates.debut", label: "Date de début" },
  { key: "dates.fin", label: "Date de fin (ou « sans terme fixe »)" },
];

const COMMON_NOTES = `>> ${DRAFT_NOTICE}. Ce texte est un point de départ rédigé pour l'application : il n'a aucune valeur juridique tant qu'il n'a pas été relu, complété et validé. Les mentions entre crochets sont à compléter par le club avant d'activer une nouvelle version.
>> Droit applicable : les passages marqués [MAROC] et [FRANCE] changent selon que l'entité qui encaisse est marocaine (loi 31-08 sur la protection du consommateur, loi 09-08 et CNDP, loi 53-05 sur l'échange électronique de données juridiques) ou française (Code de la consommation, RGPD et CNIL, articles 1366 et 1367 du Code civil). Garder une seule variante avant activation.`;

const PARTIES_CLUB = `**Le club** : [RAISON SOCIALE], [FORME JURIDIQUE] au capital de [CAPITAL], dont le siège est situé [SIÈGE], immatriculée sous le numéro [ICE / SIREN], représentée par [REPRÉSENTANTE LÉGALE], ci-après « le Club » ou « {{club.nom}} ».`;

const ACCEPTANCE_ARTICLE = (n: number, who: string) => `## Article ${n} — Acceptation électronique et preuve

${who} accepte le présent contrat en cochant la case « J'ai lu et j'accepte » dans l'application. Le Club conserve, à titre de preuve, la date et l'heure de l'acceptation, l'adresse IP, le navigateur utilisé, la version du modèle et l'empreinte numérique (SHA-256) du document PDF accepté. Les parties reconnaissent à cette acceptation la même valeur qu'une signature manuscrite.

[MAROC] Conformément à la loi n° 53-05 relative à l'échange électronique de données juridiques.
[FRANCE] Conformément aux articles 1366 et 1367 du Code civil.

Une copie du contrat au format PDF est envoyée par e-mail après l'acceptation et reste disponible à tout moment dans l'espace « Mes contrats ».

>> Une signature électronique qualifiée ou avancée (Yousign, Docusign) peut remplacer la case à cocher sans changer le texte ; à décider avec le juriste selon le niveau de preuve souhaité.`;

const LAW_ARTICLE = (n: number, consumer: boolean) => `## Article ${n} — Droit applicable et litiges

Le présent contrat est régi par le droit [DROIT APPLICABLE : Maroc ou France]. Avant toute action, les parties recherchent une solution amiable : toute réclamation est adressée par écrit à [E-MAIL DE CONTACT DU CLUB], qui y répond sous [15] jours.
${
  consumer
    ? `
[FRANCE] La Membre peut recourir gratuitement au médiateur de la consommation [NOM ET COORDONNÉES DU MÉDIATEUR], conformément à l'article L612-1 du Code de la consommation, ainsi qu'à la plateforme européenne de règlement en ligne des litiges.

À défaut d'accord amiable, le litige est porté devant [TRIBUNAL COMPÉTENT], sous réserve des règles impératives qui permettent à la consommatrice de saisir la juridiction de son domicile.
`
    : `
À défaut d'accord amiable dans un délai de trente (30) jours, le litige est porté devant [TRIBUNAL COMPÉTENT].
>> Entre professionnels, la clause attributive de juridiction est en principe valable (tribunal de commerce du siège du Club, par exemple) ; à confirmer par le juriste.
`
}`;

const MEMBERSHIP = `${COMMON_NOTES}
>> Échéancier : la cliente veut permettre le paiement en une, trois ou douze fois. Préciser s'il y a des frais de paiement fractionné et ce qui se passe en cas d'impayé (article 3).

# Contrat d'adhésion au Nomad Club

Contrat n° {{contrat.numero}} · établi le {{contrat.date}} · modèle version {{modele.version}}

## Entre les soussignées

${PARTIES_CLUB}

**La membre** : {{signataire.nom}}, joignable à l'adresse {{signataire.email}} et au {{signataire.telephone}}, carte de membre {{signataire.carte}}, ci-après « la Membre ».

## Article 1 — Objet

Le présent contrat définit les conditions dans lesquelles la Membre adhère au {{club.nom}}, cercle de femmes entrepreneuses installées à Marrakech, avec la formule **{{formule.nom}}**.

Pendant toute la durée de l'adhésion, la Membre a accès à l'application du club (espace membre, annuaire, messagerie et groupes, carnet d'adresses, carte, offres partenaires, ressources digitales, Espace Business, parrainage) et aux rendez-vous du club aux conditions de sa formule.

Ce que comprend la formule {{formule.nom}} : {{formule.avantages}}

## Article 2 — Durée

L'adhésion est conclue pour une durée d'un (1) an, du {{dates.debut}} au {{dates.fin}}. Elle prend effet au premier paiement, ou à la validation du virement par le Club.

## Article 3 — Prix et échéancier

Le prix de l'adhésion est de **{{montant.total}}** (devise : {{montant.devise}}), toutes taxes comprises [TVA : préciser le régime applicable].

Il est payable en {{echeancier.nombre}}, selon l'échéancier suivant :

{{echeancier.detail}}

Le paiement en plusieurs fois ne modifie pas la durée de l'engagement : les échéances restent dues jusqu'au terme prévu, sauf rétractation (article 6) ou résiliation dans les cas prévus à l'article 5. [FRAIS : aucun frais de paiement fractionné — à confirmer.]

En cas d'échéance impayée, le Club adresse une relance. Si l'échéance n'est pas réglée dans un délai de [15] jours après la relance, le Club peut suspendre l'accès à l'application jusqu'à la régularisation ; la suspension ne prolonge pas la durée de l'adhésion.

## Article 4 — Renouvellement

L'adhésion n'est pas reconduite tacitement. Le Club informe la Membre au moins [30] jours avant l'échéance ; la Membre renouvelle si elle le souhaite, depuis son espace. Chaque renouvellement donne lieu à un nouveau contrat, établi selon le modèle en vigueur à cette date.

>> [FRANCE] Si une reconduction tacite était choisie, l'article L215-1 du Code de la consommation imposerait d'informer la consommatrice par écrit, entre trois mois et un mois avant le terme, de la possibilité de ne pas reconduire. Le choix « sans reconduction tacite » évite cette obligation.

## Article 5 — Résiliation

**5.1 Par la Membre.** La Membre peut mettre fin à son adhésion à tout moment, depuis son espace ou par écrit à [E-MAIL DE CONTACT DU CLUB]. Sauf manquement du Club, les sommes déjà versées restent acquises et les échéances restantes [restent dues / sont annulées — à trancher].

**5.2 Par le Club.** En cas de manquement grave aux règles de vie (article 7), le Club peut résilier l'adhésion après une mise en demeure restée sans effet pendant [8] jours. En cas de harcèlement, de propos haineux, de fraude ou de mise en danger d'autres membres, le Club peut suspendre l'accès immédiatement, puis résilier. [REMBOURSEMENT : au prorata de la période restante ou non — à trancher.]

>> À trancher avec le juriste : conséquences financières d'une résiliation anticipée à l'initiative de la Membre (échéances restantes dues ou non) et clause pénale éventuelle, encadrée dans les deux droits (clauses abusives : loi 31-08 art. 15 et suivants ; Code de la consommation art. L212-1 et R212-1).

## Article 6 — Droit de rétractation

[MAROC] Conformément à l'article 36 de la loi n° 31-08 édictant des mesures de protection du consommateur, la Membre dispose d'un délai de sept (7) jours à compter de l'acceptation du présent contrat pour se rétracter, sans avoir à se justifier ni à payer de pénalité.

[FRANCE] Conformément aux articles L221-18 et suivants du Code de la consommation, la Membre dispose d'un délai de quatorze (14) jours à compter de l'acceptation du présent contrat pour se rétracter, sans avoir à se justifier ni à payer de pénalité. Si elle demande expressément à accéder aux services avant la fin de ce délai, elle reste redevable, en cas de rétractation, d'un montant proportionnel au service fourni (article L221-25).

La rétractation s'exerce par un message écrit à [E-MAIL DE CONTACT DU CLUB] ou depuis l'application. Le Club rembourse la totalité des sommes versées dans un délai de [14] jours, par le même moyen de paiement.

>> [MAROC] Loi 31-08, art. 36 : sept jours, portés à trente jours si le professionnel n'a pas fourni les informations prévues à l'article 29. Vérifier l'application au contrat d'adhésion conclu en ligne.
>> [FRANCE] Quatorze jours ; le formulaire type de rétractation (annexe de l'article R221-1) doit être joint au contrat : annexe à ajouter.

## Article 7 — Règles de vie et modération

Le club repose sur la bienveillance et la confiance. La Membre s'engage à :

- respecter les autres membres, partenaires et professionnelles, dans l'application comme lors des rendez-vous ;
- garder confidentiels les échanges du cercle (salon, groupes, messages privés) et les coordonnées de l'annuaire ;
- ne pas utiliser l'annuaire ni la messagerie pour du démarchage insistant ou de la publicité non sollicitée ;
- ne publier aucun contenu illicite, haineux, diffamatoire, ou portant atteinte à la vie privée ou aux droits d'autrui.

Le Club et ses modératrices peuvent masquer un message, adresser un avertissement, retirer l'accès à un groupe ou suspendre un compte. La messagerie utilise un filtrage par mots-clés et les signalements des membres. La Membre reste seule responsable des contenus qu'elle publie.

## Article 8 — Données personnelles et géolocalisation

Le responsable du traitement est [RAISON SOCIALE]. Le Club traite les données nécessaires à l'adhésion (identité, coordonnées, profil d'annuaire, adhésion et paiements, réservations, messages, contrats) pour exécuter le présent contrat, respecter ses obligations légales et, avec le consentement de la Membre, lui adresser des communications.

**Géolocalisation.** La position de la Membre n'est affichée sur la carte du club qu'avec son consentement exprès, de façon approximative (quartier ou environ 500 mètres), avec ou sans son nom. Elle peut retirer ce consentement à tout moment : sa position est alors effacée.

L'annuaire, les communications et le droit à l'image (article 9) font l'objet de réglages distincts, modifiables à tout moment dans « Mes données ». Les données sont conservées pendant la durée de l'adhésion puis [3] ans pour la relation avec les anciennes membres ; les contrats et paiements sont conservés pendant la durée légale [10 ans — à confirmer]. La Membre peut accéder à ses données, les rectifier, les télécharger, s'opposer à un traitement ou demander la suppression de son compte depuis « Mes données » ou à [E-MAIL DE CONTACT DONNÉES PERSONNELLES].

[MAROC] Traitement déclaré auprès de la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP), conformément à la loi n° 09-08, sous le numéro [N° DE DÉCLARATION CNDP].
[FRANCE] Traitement conforme au règlement (UE) 2016/679 (RGPD) ; la Membre peut introduire une réclamation auprès de la CNIL.

Les données sont hébergées par [HÉBERGEURS ET PAYS : Supabase, Vercel…].

>> [MAROC] Hébergement hors du Maroc : le transfert de données vers l'étranger peut nécessiter une autorisation préalable de la CNDP (loi 09-08, articles 43 et 44). À vérifier.
>> [FRANCE] Transferts hors Union européenne : documenter le cadre (clauses contractuelles types, cadre UE–États-Unis) dans le registre des traitements.

## Article 9 — Droit à l'image

Des photos et vidéos peuvent être prises lors des rendez-vous du club. Le Club n'utilise l'image de la Membre (application, site, réseaux sociaux du club) qu'avec son consentement, donné ou retiré à tout moment dans « Mes données ». Sans ce consentement, le Club ne publie pas les images où la Membre est reconnaissable, ou les floute. Aucune image n'est cédée à des tiers à des fins commerciales.

## Article 10 — Parrainage

La Membre dispose d'un code personnel de parrainage. Les récompenses sont attribuées selon les règles affichées dans l'application au moment où la filleule devient membre. Elles n'ont pas de valeur monétaire et ne peuvent être échangées contre de l'argent. Le Club peut faire évoluer ou arrêter le programme pour l'avenir ; un parrainage frauduleux est annulé.

## Article 11 — Espace Business

L'Espace Business permet aux membres de déclarer les affaires conclues entre elles. **Le Club ne prélève aucune commission sur ces affaires et n'y est pas partie** : il ne garantit ni la qualité, ni l'exécution, ni le paiement des prestations, et n'est pas responsable des litiges entre membres. Les points attribués sont symboliques et sans valeur monétaire. La Membre s'engage à ne déclarer que des affaires réelles ; elle peut se retirer du classement à tout moment.

## Article 12 — Offres partenaires et carnet d'adresses

Les offres des partenaires et les fiches des professionnelles du carnet sont proposées sous la seule responsabilité de ces établissements. Le Club les sélectionne avec soin mais ne garantit pas leurs prestations ; leur référencement ne constitue pas une recommandation personnalisée.

## Article 13 — Marque et contenus

La marque {{club.nom}}, son logo, l'application et les ressources digitales sont protégés. La Membre peut les utiliser pour son usage personnel ; elle ne peut ni les reproduire, ni les revendre, ni se présenter comme représentante du club, ni utiliser la marque sans l'accord écrit du Club.

## Article 14 — Responsabilité

Le Club est tenu d'une obligation de moyens. Il s'efforce d'assurer l'accès à l'application en continu, sans pouvoir le garantir (maintenance, panne, force majeure). Lors des rendez-vous organisés chez des établissements tiers, chaque établissement reste responsable de ses propres prestations. [LIMITATION DE RESPONSABILITÉ : à préciser dans les limites permises par le droit de la consommation.]

${ACCEPTANCE_ARTICLE(15, "La Membre")}

## Article 16 — Évolution des conditions

Le Club peut faire évoluer les présentes conditions. Les nouvelles versions s'appliquent aux nouvelles adhésions et aux renouvellements ; un contrat en cours garde la version acceptée, sauf évolution imposée par la loi.

${LAW_ARTICLE(17, true)}
Fait électroniquement, le {{contrat.date}}.
`;

const PARTNER = `${COMMON_NOTES}
>> Contrat entre professionnels : pas de droit de rétractation en principe. [FRANCE] Exception : un professionnel employant cinq salariés au plus, pour un contrat hors de son activité principale conclu hors établissement (article L221-3 du Code de la consommation) ; à apprécier par le juriste.
>> À décider par la cliente : le partenariat est-il gratuit pour l'établissement (aujourd'hui : oui) ? Durée initiale et préavis.

# Contrat de partenariat — offres aux membres

Contrat n° {{contrat.numero}} · établi le {{contrat.date}} · modèle version {{modele.version}}

## Entre les soussignés

${PARTIES_CLUB}

**Le partenaire** : l'établissement **{{etablissement.nom}}** ({{etablissement.categorie}}), situé {{etablissement.adresse}}, [FORME JURIDIQUE ET IMMATRICULATION DU PARTENAIRE], représenté par {{signataire.nom}} ({{signataire.email}}), ci-après « le Partenaire ».

## Article 1 — Objet

Le Partenaire propose aux membres du {{club.nom}} des avantages (réductions, attentions, accès privilégiés) publiés dans l'application du club. Le Club les fait connaître à ses membres, met à disposition du Partenaire un espace dédié (offres, validation des codes, statistiques, fiche de l'établissement) et le fait figurer sur la carte et dans le carnet.

## Article 2 — Durée

Le contrat prend effet le {{dates.debut}} pour une durée d'un (1) an. Il est ensuite reconduit tacitement par périodes d'un an, sauf dénonciation par l'une des parties avec un préavis de [30] jours.

## Article 3 — Conditions financières

Le partenariat est conclu à titre gratuit : aucune somme n'est due par le Partenaire au Club, et le Club ne perçoit aucune commission sur les ventes réalisées grâce aux offres. [Si un partenariat payant est prévu : PRIX ET MODALITÉS — à compléter.]

{{echeancier.detail}}

## Article 4 — Obligations du Partenaire

Le Partenaire s'engage à :

- honorer les offres publiées pendant toute leur période de validité, pour toute membre présentant un code valide ;
- rédiger des conditions claires (périmètre, exclusions, nombre d'utilisations) et les tenir à jour, en mettant en pause une offre qu'il ne peut plus honorer ;
- valider les codes au comptoir dans l'application, une seule fois, et ne pas en faire d'autre usage ;
- accueillir les membres sans discrimination, dans le respect de la réglementation applicable à son activité (hygiène, sécurité, assurances, autorisations) ;
- informer le Club de tout changement important (adresse, horaires, fermeture, changement de dirigeant).

## Article 5 — Obligations du Club

Le Club présente les offres du Partenaire à ses membres de façon loyale, met à sa disposition l'espace partenaire et ses statistiques, et le prévient avant toute modification importante du fonctionnement des offres.

## Article 6 — Règles de vie et modération

Les membres de l'équipe du Partenaire qui utilisent l'application respectent les règles de vie du club (respect, confidentialité, absence de démarchage abusif). Le Club peut retirer une offre ou une fiche contraire à ces règles ou à la loi, après en avoir informé le Partenaire, sauf urgence.

## Article 7 — Données personnelles et géolocalisation

Chaque partie est responsable des traitements qu'elle met en œuvre. Lors de la validation d'un code, le Partenaire ne voit que le prénom de la membre et l'offre utilisée ; il ne reçoit ni ses coordonnées ni sa position. Il s'interdit de constituer un fichier des membres ou de les solliciter à partir de ces informations.

La position de l'établissement (adresse professionnelle) est affichée sur la carte du club. La géolocalisation des membres n'est jamais communiquée au Partenaire.

[MAROC] Les parties respectent la loi n° 09-08 et les délibérations de la CNDP.
[FRANCE] Les parties respectent le RGPD ; si le Partenaire traitait des données pour le compte du Club, un accord de sous-traitance (article 28) serait conclu.

## Article 8 — Statistiques

Le Club fournit au Partenaire, dans son espace, des statistiques mensuelles propres à son établissement (vues de la fiche, clics de contact, codes générés et validés). Ces statistiques sont agrégées et ne permettent pas d'identifier les membres. Le Club peut utiliser des statistiques globales et anonymes de son réseau.

## Article 9 — Droit à l'image et usage des marques

Le Partenaire autorise le Club à utiliser son nom, son logo et les photos de son établissement qu'il fournit, dans l'application et dans la communication du club, pendant la durée du contrat. Le Partenaire peut indiquer « Partenaire du {{club.nom}} » selon la charte fournie par le Club ; toute autre utilisation de la marque {{club.nom}} requiert un accord écrit. Les photos de membres prises dans l'établissement ne sont publiées qu'avec le consentement des personnes concernées.

## Article 10 — Parrainage et Espace Business

Le Partenaire peut faire connaître le club à sa clientèle ; il ne perçoit pas de récompense de parrainage, sauf accord écrit. **Le Club ne prélève aucune commission sur les affaires conclues entre le Partenaire et les membres et n'y est pas partie** ; il n'est pas responsable de leur exécution.

## Article 11 — Responsabilité

Le Partenaire est seul responsable des produits et services qu'il fournit aux membres, de leur conformité et de leur prix. Il déclare être assuré pour son activité. Le Club, simple intermédiaire d'information, ne peut être tenu responsable d'un litige entre le Partenaire et une membre, ni des dommages indirects.

## Article 12 — Résiliation

Chaque partie peut résilier le contrat à l'échéance annuelle moyennant le préavis prévu à l'article 2, ou à tout moment en cas de manquement grave de l'autre partie non corrigé dans un délai de [15] jours après une mise en demeure. Les offres en cours sont alors retirées de l'application ; les codes déjà émis sont honorés jusqu'à leur date limite.

${ACCEPTANCE_ARTICLE(13, "Le Partenaire")}

${LAW_ARTICLE(14, false)}
Fait électroniquement, le {{contrat.date}}.
`;

const PRO = `${COMMON_NOTES}
>> Contrat entre professionnels : pas de droit de rétractation en principe. [FRANCE] Exception possible pour un professionnel de cinq salariés au plus (article L221-3 du Code de la consommation).
>> Professions réglementées (santé, droit, finance…) : vérifier les règles de publicité propres à chaque profession (codes de déontologie) avant de référencer.

# Contrat de référencement — carnet d'adresses du Nomad Club

Contrat n° {{contrat.numero}} · établi le {{contrat.date}} · modèle version {{modele.version}}

## Entre les soussignés

${PARTIES_CLUB}

**La professionnelle** : **{{etablissement.nom}}** ({{etablissement.categorie}}), située {{etablissement.adresse}}, [FORME JURIDIQUE ET IMMATRICULATION DE LA PROFESSIONNELLE], représentée par {{signataire.nom}} ({{signataire.email}}), ci-après « la Professionnelle ».

## Article 1 — Objet

Le Club référence la Professionnelle dans le carnet d'adresses de son application, réservé aux membres, avec la formule **{{formule.nom}}** : {{formule.avantages}}. La Professionnelle dispose d'un espace pour gérer sa fiche, son abonnement et ses statistiques de visibilité. Le référencement ne suppose pas de proposer une réduction aux membres.

## Article 2 — Durée et renouvellement

L'abonnement prend effet le {{dates.debut}}. Il est conclu pour une durée d'un (1) mois, renouvelée tacitement de mois en mois tant qu'il n'est pas arrêté. La Professionnelle peut l'arrêter à tout moment depuis son espace : l'arrêt prend effet à la fin de la période mensuelle en cours, déjà payée.

## Article 3 — Prix et paiement

Grille tarifaire : [PRIX MENSUEL PRO — grille à confirmer : Essentiel, Visibilité, Vitrine]. Pour la formule choisie, le prix est de **{{montant.mensuel}} par mois** (devise : {{montant.devise}}), [HT / TTC — à préciser], payable d'avance :

{{echeancier.detail}}

Un changement de formule s'applique immédiatement et est facturé à l'échéance suivante. Le Club peut faire évoluer ses prix pour l'avenir en prévenant la Professionnelle au moins [30] jours à l'avance ; elle peut alors arrêter son abonnement sans frais.

## Article 4 — Retard de paiement

Si une échéance n'est pas réglée à sa date, la fiche est masquée du carnet jusqu'au paiement. Après quinze (15) jours de retard, l'abonnement est suspendu. Les sommes versées pour une période commencée restent acquises. [PÉNALITÉS DE RETARD ET INDEMNITÉ DE RECOUVREMENT : à préciser selon le droit applicable.]

## Article 5 — Obligations de la Professionnelle

La Professionnelle s'engage à :

- fournir des informations exactes et à jour (activité, coordonnées, horaires, photos dont elle détient les droits) ;
- détenir les diplômes, autorisations et assurances exigés pour son activité, et respecter les règles de sa profession, notamment en matière de publicité ;
- ne publier aucune allégation trompeuse ni contenu contraire à la loi ;
- accueillir les membres avec le même sérieux que sa clientèle, et honorer la réduction qu'elle a éventuellement annoncée.

## Article 6 — Modération des fiches

Le Club peut refuser, modifier ou retirer une fiche (ou un élément de fiche) contraire au présent contrat, aux règles de vie du club ou à la loi, après en avoir informé la Professionnelle, sauf urgence. Les membres de l'équipe de la Professionnelle qui utilisent l'application respectent les règles de vie du club.

## Article 7 — Statistiques

Le Club fournit chaque mois, dans l'espace de la Professionnelle, des statistiques de visibilité propres à sa fiche (vues, clics vers le téléphone, WhatsApp, le site, l'itinéraire). Elles sont agrégées et ne permettent pas d'identifier les membres. Le Club ne garantit aucun volume de visites ni de clientèle.

## Article 8 — Données personnelles et géolocalisation

Chaque partie est responsable des traitements qu'elle met en œuvre. L'adresse professionnelle et la position de l'établissement peuvent être affichées sur la carte du club ; la géolocalisation des membres n'est jamais communiquée à la Professionnelle. Les membres qui la contactent le font directement, par les moyens qu'elle a publiés.

[MAROC] Les parties respectent la loi n° 09-08 et les délibérations de la CNDP.
[FRANCE] Les parties respectent le RGPD.

## Article 9 — Droit à l'image et usage des marques

La Professionnelle autorise le Club à utiliser son nom, son logo et les photos qu'elle fournit, dans l'application et la communication du club, pendant la durée de l'abonnement. Elle peut indiquer « Référencée par le {{club.nom}} » selon la charte fournie ; toute autre utilisation de la marque requiert un accord écrit du Club.

## Article 10 — Parrainage et Espace Business

La Professionnelle peut faire connaître le club ; elle ne perçoit pas de récompense de parrainage, sauf accord écrit. **Le Club ne prélève aucune commission sur les prestations vendues aux membres et n'est pas partie aux contrats conclus avec elles** ; il n'est pas responsable de leur exécution ni de leur paiement.

## Article 11 — Responsabilité

Le référencement est un service d'information : il ne constitue ni une recommandation personnalisée ni une garantie des prestations. La Professionnelle est seule responsable de ses prestations envers les membres. La responsabilité du Club, tenu d'une obligation de moyens, est limitée au montant des trois derniers mois d'abonnement payés, sauf faute lourde ou dolosive.

## Article 12 — Résiliation

Outre l'arrêt mensuel prévu à l'article 2, chaque partie peut résilier le contrat en cas de manquement grave de l'autre partie non corrigé dans un délai de [8] jours après une mise en demeure. La fiche est alors retirée du carnet.

${ACCEPTANCE_ARTICLE(13, "La Professionnelle")}

${LAW_ARTICLE(14, false)}
Fait électroniquement, le {{contrat.date}}.
`;

export type InitialTemplate = { id: string; kind: ContractKind; version: 1; title: string; bodyMd: string; effectiveFrom: string };

/** Identifiants fixes des modèles v1 (les mêmes en démo et dans la migration). */
export const INITIAL_TEMPLATES: readonly InitialTemplate[] = [
  { id: "0c0a0000-0000-4000-a000-000000000001", kind: "membership", version: 1, title: "Contrat d'adhésion (Membre / Premium)", bodyMd: MEMBERSHIP, effectiveFrom: "2025-09-01" },
  { id: "0c0a0000-0000-4000-a000-000000000002", kind: "partner", version: 1, title: "Contrat de partenariat (offres aux membres)", bodyMd: PARTNER, effectiveFrom: "2025-09-01" },
  { id: "0c0a0000-0000-4000-a000-000000000003", kind: "pro", version: 1, title: "Contrat de référencement (carnet, abonnement mensuel)", bodyMd: PRO, effectiveFrom: "2025-09-01" },
];
