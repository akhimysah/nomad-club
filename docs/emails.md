# E-mails transactionnels

Module `src/lib/modules/emails/`, migration `supabase/migrations/0011_emails.sql`, pages `/fondatrices/emails` et `/fondatrices/emails/apercu/[modele]`.

## Fonctionnement

- **Fournisseur** (interface `Mailer`, `types.ts`) : `resend` (API HTTP, sans SDK) si `RESEND_API_KEY` est définie ; sinon `console` (rien ne part : une ligne dans les logs du serveur et les 50 derniers envois en mémoire). `smtp` est prévu (`mailers/smtp.ts`, marche à suivre en tête du fichier : `nodemailer`). `EMAIL_PROVIDER=resend|console|smtp` force le choix.
- **Point d'extension** : `src/lib/mail-hook.ts`. `src/instrumentation.ts` appelle `registerEmails()` au démarrage du serveur ; `sendEmail()` se branche aussi tout seul au premier appel. Les autres chantiers appellent simplement :

  ```ts
  import { sendEmail } from "@/lib/mail-hook";
  await sendEmail({ template: "contract_accepted", to, profileId, data: { firstName, contractTitle, version, acceptedAt, reference, sha256 },
    attachments: [{ filename: "contrat.pdf", content: pdfBytes, contentType: "application/pdf" }] });
  ```

  `sendEmail` renvoie `false` en cas d'échec, sans jamais lever d'erreur. Les données attendues par chaque modèle sont dans son schéma (`templates.ts`) ; les montants et dates arrivent **déjà mis en forme** (chaînes).
- **Notifications** : `notify()` (`src/lib/notify.ts`) relaie chaque notification par e-mail (`notify-channel.ts`, règles pures dans `channel.ts`). Les e-mails **essentiels** partent toujours (billet, reçu de paiement, changement d'accès) ; les autres respectent la préférence « E-mail » du type (absente = active, comme dans l'écran des préférences). Les annonces au cercle (nouveau rendez-vous, actualité) partent en lots de 100 (API batch de Resend).
- **Désinscription** : les e-mails non essentiels portent un lien « Ne plus recevoir ces e-mails » (page `/e-mails/desinscription`, confirmation obligatoire) et les en-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` (désinscription en un clic de Gmail / Apple Mail, `POST /api/emails/desinscription`). Le jeton est signé (HMAC) avec `EMAIL_UNSUBSCRIBE_SECRET` (à défaut `CRON_SECRET`, puis la clé service). Il coupe seulement la préférence « e-mail » du type concerné.
- **Journal** : chaque envoi (réussi ou en échec) est enregistré dans `email_log` (mode réel, écrit avec la clé service, lu par les administratrices sous RLS, masqué en AAL1 si la 2FA est exigée par la base) ou en mémoire (démo). Les données du modèle sont gardées pour « Renvoyer » ; les pièces jointes générées (QR, .ics) sont recréées, les pièces jointes externes (PDF de contrat) ne sont pas conservées. Les lignes d'un compte anonymisé sont effacées (déclencheur sur `profiles.email`), la confirmation de suppression est journalisée avec une adresse masquée, et `/api/cron/emails` purge les envois de plus de 180 jours.

## Modèles

| Identifiant | Quand | Essentiel |
|---|---|---|
| `welcome` | première connexion d'un compte créé il y a moins de 24 h (`/auth/callback`), une seule fois | oui |
| `booking_confirmed` | réservation (notification), billet + QR intégré (`cid:billet-qr`) + rendez-vous `.ics` en pièce jointe | oui |
| `waitlist_released` | place libérée (notification `waitlist_spot`) | non |
| `event_reminder` | rappel J-1 (notification, cron `/api/cron/rappels`) | non |
| `event_published` | rendez-vous publié (notification, préférence e-mail) | non |
| `payment_receipt` | virement validé (notification `payment_validated`) ; chantier paiements : carte, échéances | oui |
| `payment_failed` | relance « impayé » des fondatrices ; chantier paiements : échec Stripe, échéance en retard | oui |
| `renewal_reminder` | `/api/cron/emails` J-30, J-7, J-1 (une fois par échéance) ; relance « renouvellement » des fondatrices | oui |
| `contract_accepted` | chantier contrats (PDF en pièce jointe) | oui |
| `team_invite` | invitation dans l'équipe d'un établissement (`inviteMemberAction`) | oui |
| `group_joined` | demande de groupe acceptée (notification) | non |
| `moderation_warning` | avertissement de modération (notification) | non |
| `data_export_ready` | export RGPD téléchargé (avis de sécurité) | oui |
| `account_deletion_scheduled` | demande de suppression de compte | oui |
| `account_deleted` | anonymisation traitée par une administratrice | oui |
| `news_published` | nouvelle actualité (notification, résumé) | non |
| `notification` | modèle générique pour les autres notifications (achat, parrainage, deals, tâches du CRM, accès…) | selon le type |

Chaque modèle se relit dans `/fondatrices/emails/apercu/<identifiant>` (ordinateur, téléphone, texte brut) avec ses données d'exemple ; « M'envoyer un exemple » l'envoie à l'adresse de l'administratrice connectée. Tests : `npm run test:emails`.

Design : bandeau noir avec le logotype clair (`/img/logotype-clair.png`, servi par le site : `NEXT_PUBLIC_SITE_URL` doit être l'adresse publique), Georgia pour les titres (repli de Playfair Display), Helvetica / Arial pour le texte, mise en page en tableaux et styles en ligne (Gmail, Apple Mail, Outlook), version texte brut systématique.

## Mise en production avec Resend

1. Créer un compte sur [resend.com](https://resend.com) (le compte de la cliente : il reste propriétaire du domaine d'envoi).
2. **Domains › Add domain** : utiliser un sous-domaine dédié, par exemple `mail.[DOMAINE]` (ou le domaine principal). Région : `eu-west-1` (Irlande).
3. Ajouter chez l'hébergeur DNS du domaine les enregistrements affichés par Resend :
   - **SPF** : enregistrement `TXT` sur `send.mail.[DOMAINE]` : `v=spf1 include:amazonses.com ~all`, et l'enregistrement `MX` de retour (`feedback-smtp.eu-west-1.amazonses.com`, priorité 10) ;
   - **DKIM** : enregistrement `TXT` `resend._domainkey.mail.[DOMAINE]` (clé publique fournie par Resend) ;
   - **DMARC** : enregistrement `TXT` sur `_dmarc.[DOMAINE]` : commencer par `v=DMARC1; p=none; rua=mailto:dmarc@[DOMAINE]`, puis passer à `p=quarantine` après quelques semaines sans souci.
   Attendre que Resend affiche « Verified ».
4. **API Keys › Create** : droit « Sending access », limité au domaine. La copier dans Vercel : `RESEND_API_KEY`.
5. Dans Vercel : `EMAIL_FROM="Nomad Club <bonjour@mail.[DOMAINE]>"`, `EMAIL_REPLY_TO=` (la boîte lue par Julia et Nora), `NEXT_PUBLIC_SITE_URL=https://[DOMAINE]`, `EMAIL_UNSUBSCRIBE_SECRET=` (`openssl rand -hex 32`), `CRON_SECRET` et `SUPABASE_SERVICE_ROLE_KEY` (journal, destinataires des notifications, cron).
6. Appliquer la migration `0011_emails.sql`, redéployer, puis envoyer un exemple de chaque modèle depuis `/fondatrices/emails/apercu/...` et vérifier sur [mail-tester.com](https://www.mail-tester.com) (score attendu ≥ 9/10).

Limites de Resend à connaître : 100 e-mails par jour et 3 000 par mois en offre gratuite, 2 requêtes par seconde par défaut (les annonces partent en lots de 100 pour rester dessous). Au-delà de ~150 membres, prendre l'offre Pro.

## Lien magique (Supabase Auth) par Resend

Le lien de connexion est envoyé par Supabase Auth, pas par l'appli. Le service d'e-mail intégré de Supabase est limité (quelques envois par heure) : le brancher sur Resend.

1. Supabase › **Project Settings › Authentication › SMTP Settings** › « Enable Custom SMTP » :
   - Sender email : `bonjour@mail.[DOMAINE]` · Sender name : `Nomad Club`
   - Host : `smtp.resend.com` · Port : `465` · Username : `resend` · Password : une clé API Resend (« Sending access »)
   - Minimum interval : 30 secondes.
2. Supabase › **Authentication › Rate Limits** : relever « Emails sent per hour » (ex. 100).
3. Supabase › **Authentication › URL Configuration** : Site URL `https://[DOMAINE]`, Redirect URLs `https://[DOMAINE]/auth/callback`.
4. Supabase › **Authentication › Email Templates** › « Magic Link » (et « Confirm signup », même contenu) :
   - Objet : `Ton lien de connexion au Nomad Club`
   - Corps (HTML) :

```html
<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f3f2ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f2ef" style="background:#f3f2ef;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td bgcolor="#111111" align="center" style="background:#111111;padding:26px 24px;">
<img src="{{ .SiteURL }}/img/logotype-clair.png" width="180" alt="NOMAD CLUB" style="display:block;width:180px;max-width:60%;height:auto;border:0;color:#ffffff;font-family:Georgia,serif;font-size:22px;letter-spacing:.24em;">
</td></tr>
<tr><td style="padding:36px 32px 12px;">
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:normal;color:#111111;">Ton lien de connexion</h1>
<p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111111;">Bonjour,<br>Voici ton lien pour te connecter à l’appli du Nomad Club. Il est valable une heure et ne sert qu’une fois. Ouvre-le sur l’appareil où tu l’as demandé.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td bgcolor="#111111" style="border-radius:999px;background:#111111;">
<a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Me connecter</a>
</td></tr></table>
<p style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:#6b6b6b;">Le bouton ne marche pas ? Copie cette adresse dans ton navigateur :<br><a href="{{ .ConfirmationURL }}" style="color:#6b6b6b;word-break:break-all;">{{ .ConfirmationURL }}</a></p>
<p style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55;color:#6b6b6b;">Tu n’as rien demandé ? Ignore simplement cet e-mail : personne ne peut se connecter sans ce lien.</p>
</td></tr>
<tr><td style="padding:0 32px 30px;"><p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111111;">À très vite,<br><span style="font-family:Georgia,serif;font-size:17px;">Julia et Nora</span></p></td></tr>
</table>
<p style="margin:16px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#6b6b6b;">Nomad Club · Le cercle des femmes entrepreneuses à Marrakech</p>
</td></tr>
</table>
</body>
</html>
```

5. Tester : `/connexion` avec une vraie adresse, vérifier l'arrivée (et l'expéditeur) dans Gmail et Apple Mail.

## Ce que la cliente doit fournir

- Le **nom de domaine** d'envoi et l'accès à sa zone DNS (ou une personne qui peut ajouter les enregistrements SPF, DKIM, DMARC).
- Un **compte Resend** à son nom (offre gratuite pour commencer), et la boîte de réponse (`EMAIL_REPLY_TO`).
- La relecture des textes de chaque modèle (`/fondatrices/emails/apercu/...`), en particulier suppression de compte, contrat et modération.
