/**
 * Modèles d'e-mail en français (module pur : aucune dépendance au serveur, testé par `npm run test:emails`).
 *
 * Chaque modèle déclare : son schéma de données (zod, valeurs par défaut tolérantes), des données d'exemple
 * (aperçu dans /fondatrices/emails/apercu/[modele] et tests), s'il est essentiel (billet, reçu, contrat,
 * sécurité : part toujours, sans lien de désinscription) et le type de notification dont la préférence
 * « e-mail » le coupe. Les montants et dates arrivent déjà mis en forme (chaînes).
 */
import { z } from "zod";
import type { Block } from "./layout.ts";
import type { TemplateId } from "./types.ts";

export type RenderContext = {
  baseUrl: string;
  /** Images intégrées disponibles : contentId → src (`cid:…` à l'envoi, `data:` dans l'aperçu). */
  inline?: Record<string, string>;
};

export type RenderedParts = { subject: string; preheader: string; blocks: Block[]; reason?: string };

export type EmailTemplate = {
  id: TemplateId;
  label: string;
  description: string;
  essential: boolean;
  /** Préférence de notifications qui coupe ce modèle (null : aucune). */
  prefType: string | null;
  sample: Record<string, unknown>;
  build(data: unknown, ctx: RenderContext): RenderedParts;
  /** Préférence propre aux données (modèle générique « notification »). */
  prefTypeOf?(data: unknown): string | null;
};

/** Identifiant de l'image intégrée du QR code du billet. */
export const TICKET_QR_CID = "billet-qr";

const s = (d = "") => z.string().max(4000).default(d).catch(d);
const n = (d = 0) => z.coerce.number().finite().default(d).catch(d);
const b = (d = false) => z.boolean().default(d).catch(d);

/** Adresse absolue (les liens des notifications sont internes : « /espace/agenda/… »). */
export function absUrl(ctx: RenderContext, link: string | null | undefined, fallback = "/"): string {
  const l = (link || fallback).trim();
  if (/^https?:\/\//i.test(l)) return l;
  return ctx.baseUrl.replace(/\/$/, "") + (l.startsWith("/") ? l : "/" + l);
}

const hello = (firstName: string) => (firstName.trim() ? `Bonjour ${firstName.trim()},` : "Bonjour,");

function define<S extends z.ZodTypeAny>(t: {
  id: TemplateId;
  label: string;
  description: string;
  essential: boolean;
  prefType: string | null;
  schema: S;
  sample: z.input<S>;
  render(d: z.output<S>, ctx: RenderContext): RenderedParts;
  prefTypeOf?(d: z.output<S>): string | null;
}): EmailTemplate {
  return {
    id: t.id,
    label: t.label,
    description: t.description,
    essential: t.essential,
    prefType: t.prefType,
    sample: t.sample as Record<string, unknown>,
    build: (data, ctx) => t.render(t.schema.parse(data ?? {}), ctx),
    prefTypeOf: t.prefTypeOf ? (data) => t.prefTypeOf!(t.schema.parse(data ?? {})) : undefined,
  };
}

const eventRows = (d: { dateLabel: string; venue: string; address: string }) =>
  [
    ["Quand", d.dateLabel],
    ["Où", [d.venue, d.address].filter(Boolean).join("\n") || "Lieu communiqué très vite"],
  ].filter(([, v]) => v) as Array<[string, string]>;

/* ------------------------------------------------------------------ */

const welcome = define({
  id: "welcome",
  label: "Bienvenue",
  description: "Compte créé (première connexion par lien magique).",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s() }),
  sample: { firstName: "Inès" },
  render: (d, ctx) => ({
    subject: "Bienvenue au Nomad Club",
    preheader: "Ton compte est prêt : rendez-vous, carnet d’adresses et cercle t’attendent.",
    blocks: [
      { t: "h1", text: d.firstName ? `Bienvenue, ${d.firstName}` : "Bienvenue au Nomad Club" },
      { t: "p", text: "Ton compte est créé. Tu peux dès maintenant :" },
      {
        t: "list",
        items: ["réserver ta place aux prochains rendez-vous du club ;", "retrouver tes billets et ton agenda au même endroit ;", "découvrir les adhésions pour rejoindre le cercle, le carnet d’adresses et les offres partenaires."],
      },
      { t: "button", label: "Ouvrir mon espace", url: absUrl(ctx, "/espace") },
      { t: "note", text: "Astuce : ajoute l’appli à l’écran d’accueil de ton téléphone pour l’ouvrir en un geste. Pour te connecter, il suffit de ton adresse e-mail : on t’envoie un lien, sans mot de passe." },
    ],
    reason: "Tu reçois cet e-mail parce qu’un compte vient d’être créé avec cette adresse.",
  }),
});

const bookingConfirmed = define({
  id: "booking_confirmed",
  label: "Réservation confirmée",
  description: "Billet (code + QR code intégré) et rendez-vous en pièce jointe .ics.",
  essential: true,
  prefType: null,
  schema: z.object({
    firstName: s(),
    eventTitle: s("Rendez-vous du Nomad Club"),
    dateLabel: s(),
    venue: s(),
    address: s(),
    ticketCode: s(),
    pending: b(),
    amount: s(),
    eventUrl: s(),
    ticketUrl: s(),
  }),
  sample: {
    firstName: "Inès",
    eventTitle: "Lunch au Fer7",
    dateLabel: "samedi 14 novembre à 12 h 30",
    venue: "Fer7",
    address: "Gueliz, Marrakech",
    ticketCode: "K7Q2MX",
    pending: false,
    amount: "35 $",
    eventUrl: "/rendez-vous/lunch-fer7",
    ticketUrl: "/billet/K7Q2MX",
  },
  render: (d, ctx) => {
    const ticketUrl = absUrl(ctx, d.ticketUrl || (d.ticketCode ? `/billet/${d.ticketCode}` : "/espace/agenda"));
    const rows = eventRows(d);
    if (d.amount) rows.push(["Montant", d.amount]);
    return {
      subject: `${d.pending ? "Ta place est retenue" : "Ta place est réservée"} : ${d.eventTitle}`,
      preheader: `${d.dateLabel}${d.venue ? ` · ${d.venue}` : ""}. Ton billet ${d.ticketCode} est dans cet e-mail.`,
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: d.pending ? "Ta place est retenue" : "C’est réservé !" },
        {
          t: "p",
          text: d.pending
            ? `Ta place pour « ${d.eventTitle} » est retenue. Elle sera confirmée dès réception de ton paiement.`
            : `Ta place pour « ${d.eventTitle} » est confirmée. Présente ce QR code à l’accueil.`,
        },
        { t: "details", rows },
        ...(d.ticketCode ? [{ t: "ticket" as const, code: d.ticketCode, qrSrc: ctx.inline?.[TICKET_QR_CID] ?? null, url: ticketUrl }] : []),
        { t: "note", text: "Le fichier joint (.ics) ajoute le rendez-vous à ton calendrier, avec un rappel la veille. Un empêchement ? Annule depuis ton agenda pour libérer ta place." },
      ],
      reason: "Tu reçois cet e-mail parce que tu as réservé une place au Nomad Club.",
    };
  },
});

const waitlistReleased = define({
  id: "waitlist_released",
  label: "Place libérée (liste d’attente)",
  description: "Une place se libère sur un rendez-vous complet.",
  essential: false,
  prefType: "waitlist_spot",
  schema: z.object({ firstName: s(), eventTitle: s("un rendez-vous complet"), dateLabel: s(), venue: s(), eventUrl: s(), link: s() }),
  sample: { firstName: "Salma", eventTitle: "Dîner à Terrajana", dateLabel: "jeudi 19 novembre à 20 h", venue: "Terrajana", eventUrl: "/rendez-vous/diner-terrajana" },
  render: (d, ctx) => ({
    subject: `Une place s’est libérée : ${d.eventTitle}`,
    preheader: "Elle est à la première qui la prend.",
    blocks: [
      { t: "p", text: hello(d.firstName) },
      { t: "h1", text: "Une place vient de se libérer" },
      { t: "p", text: `Tu étais sur la liste d’attente de « ${d.eventTitle} »${d.dateLabel ? `, ${d.dateLabel}` : ""}${d.venue ? ` · ${d.venue}` : ""}. Une place est disponible : elle revient à la première qui la réserve.` },
      { t: "button", label: "Réserver ma place", url: absUrl(ctx, d.eventUrl || d.link, "/rendez-vous") },
    ],
    reason: "Tu reçois cet e-mail parce que tu es inscrite sur la liste d’attente de ce rendez-vous.",
  }),
});

const eventReminder = define({
  id: "event_reminder",
  label: "Rappel J-1",
  description: "La veille d’un rendez-vous où la personne est inscrite.",
  essential: false,
  prefType: "event_reminder",
  schema: z.object({ firstName: s(), eventTitle: s(), dateLabel: s(), venue: s(), address: s(), ticketCode: s(), title: s(), body: s(), link: s(), eventUrl: s() }),
  sample: {
    firstName: "Inès",
    eventTitle: "Lunch au Fer7",
    dateLabel: "demain, samedi 14 novembre à 12 h 30",
    venue: "Fer7",
    address: "Gueliz, Marrakech",
    ticketCode: "K7Q2MX",
    eventUrl: "/espace/agenda/lunch-fer7",
  },
  render: (d, ctx) => {
    const title = d.eventTitle || d.title.replace(/^Demain\s*:\s*/i, "") || "ton rendez-vous";
    const rows = eventRows(d);
    if (d.ticketCode) rows.push(["Billet", d.ticketCode]);
    return {
      subject: `Demain : ${title}`,
      preheader: d.body || `${d.dateLabel}${d.venue ? ` · ${d.venue}` : ""}. À demain !`,
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: "C’est demain !" },
        { t: "p", text: d.eventTitle || !d.body ? `Petit rappel : « ${title} », c’est demain. On a hâte de te voir.` : d.body },
        ...(d.dateLabel || d.venue ? [{ t: "details" as const, rows }] : []),
        { t: "button", label: "Voir le rendez-vous et mon billet", url: absUrl(ctx, d.eventUrl || d.link, "/espace/agenda") },
        { t: "note", text: "Un empêchement ? Annule depuis ton agenda : ta place reviendra à une membre sur liste d’attente." },
      ],
      reason: "Tu reçois ce rappel parce que tu es inscrite à ce rendez-vous.",
    };
  },
});

const eventPublished = define({
  id: "event_published",
  label: "Nouveau rendez-vous",
  description: "Un rendez-vous vient d’être publié (si l’option e-mail est activée).",
  essential: false,
  prefType: "event_published",
  schema: z.object({ firstName: s(), eventTitle: s("Nouveau rendez-vous"), dateLabel: s(), venue: s(), address: s(), description: s(), priceLabel: s(), eventUrl: s(), link: s() }),
  sample: {
    firstName: "Inès",
    eventTitle: "Brunch prise de parole",
    dateLabel: "dimanche 22 novembre à 11 h",
    venue: "La Terraza",
    address: "Hivernage, Marrakech",
    description: "Un brunch pour apprendre à pitcher son activité en deux minutes, avec une coach en prise de parole.",
    priceLabel: "35 $ membre · 50 $ public",
    eventUrl: "/espace/agenda/brunch-prise-de-parole",
  },
  render: (d, ctx) => {
    const rows = eventRows(d);
    if (d.priceLabel) rows.push(["Tarif", d.priceLabel]);
    return {
      subject: `Nouveau rendez-vous : ${d.eventTitle}`,
      preheader: `${d.dateLabel}${d.venue ? ` · ${d.venue}` : ""}. Les places sont ouvertes.`,
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: d.eventTitle },
        ...(d.description ? [{ t: "p" as const, text: d.description.length > 600 ? d.description.slice(0, 599) + "…" : d.description }] : []),
        { t: "details", rows },
        { t: "button", label: "Réserver ma place", url: absUrl(ctx, d.eventUrl || d.link, "/espace/agenda") },
      ],
      reason: "Tu reçois cet e-mail parce que les nouveaux rendez-vous sont activés dans tes notifications.",
    };
  },
});

const paymentReceipt = define({
  id: "payment_receipt",
  label: "Reçu de paiement",
  description: "Paiement reçu (virement validé, carte, échéance).",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s(), amount: s(), label: s("Paiement"), method: s(), paidAt: s(), reference: s(), installment: s(), link: s("/espace/moi") }),
  sample: { firstName: "Lou", amount: "670 $", label: "Adhésion annuelle Membre", method: "Virement", paidAt: "2 novembre 2026", reference: "PAY-2026-0142", installment: "" },
  render: (d, ctx) => {
    const rows: Array<[string, string]> = [["Objet", d.label]];
    if (d.amount) rows.push(["Montant", d.amount]);
    if (d.installment) rows.push(["Échéance", d.installment]);
    if (d.method) rows.push(["Moyen de paiement", d.method]);
    if (d.paidAt) rows.push(["Date", d.paidAt]);
    if (d.reference) rows.push(["Référence", d.reference]);
    return {
      subject: `Reçu : ${d.label}${d.amount ? ` · ${d.amount}` : ""}`,
      preheader: "Merci, ton paiement est bien reçu.",
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: "Paiement reçu, merci !" },
        { t: "p", text: "Voici le récapitulatif de ton paiement. Garde cet e-mail : il te sert de reçu." },
        { t: "details", rows },
        { t: "button", label: "Voir mon historique", url: absUrl(ctx, d.link, "/espace/moi") },
      ],
      reason: "Tu reçois cet e-mail parce qu’un paiement a été enregistré sur ton compte.",
    };
  },
});

const paymentFailed = define({
  id: "payment_failed",
  label: "Échec de paiement / échéance en retard",
  description: "Paiement refusé ou échéance non réglée.",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s(), amount: s(), label: s("ton échéance"), dueDate: s(), reason: s(), payUrl: s("/espace/moi") }),
  sample: { firstName: "Lou", amount: "224 $", label: "2e échéance de l’adhésion Membre", dueDate: "1er novembre 2026", reason: "Carte refusée par la banque." },
  render: (d, ctx) => {
    const rows: Array<[string, string]> = [["Objet", d.label]];
    if (d.amount) rows.push(["Montant", d.amount]);
    if (d.dueDate) rows.push(["Échéance", d.dueDate]);
    if (d.reason) rows.push(["Motif", d.reason]);
    return {
      subject: `Paiement à régulariser : ${d.label}`,
      preheader: "Ton paiement n’a pas abouti. Quelques secondes suffisent pour régulariser.",
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: "Ton paiement n’a pas abouti" },
        { t: "p", text: "Pas d’inquiétude, ça arrive. Pour garder ton accès, règle simplement le montant ci-dessous." },
        { t: "details", rows },
        { t: "button", label: "Régler maintenant", url: absUrl(ctx, d.payUrl, "/espace/moi") },
        { t: "note", text: "Une question, un souci de carte ? Réponds à cet e-mail, Julia et Nora t’aident." },
      ],
      reason: "Tu reçois cet e-mail au sujet d’un paiement lié à ton compte.",
    };
  },
});

const renewalReminder = define({
  id: "renewal_reminder",
  label: "Rappel de renouvellement",
  description: "Fin d’adhésion dans 30 jours, 7 jours ou demain (ou relance des fondatrices).",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s(), planLabel: s("Membre"), endsOn: s(), daysLeft: n(30), amount: s(), renewUrl: s("/espace/moi") }),
  sample: { firstName: "Inès", planLabel: "Membre", endsOn: "2 décembre 2026", daysLeft: 30, amount: "670 $" },
  render: (d, ctx) => {
    const when = d.daysLeft <= 0 ? "est arrivée à échéance" : d.daysLeft === 1 ? "se termine demain" : `se termine dans ${d.daysLeft} jours`;
    return {
      subject: d.daysLeft <= 0 ? "Ton adhésion est arrivée à échéance" : `Ton adhésion ${when}`,
      preheader: d.endsOn ? `Fin de ton adhésion ${d.planLabel} : ${d.endsOn}.` : "Pense à renouveler pour rester dans le cercle.",
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: d.daysLeft <= 0 ? "Ton adhésion est échue" : d.daysLeft === 1 ? "Ton adhésion se termine demain" : `Plus que ${d.daysLeft} jours` },
        {
          t: "p",
          text: `Ton adhésion ${d.planLabel} ${when}${d.endsOn ? ` (${d.endsOn})` : ""}. Renouvelle-la pour garder l’accès au cercle, au carnet d’adresses, aux offres partenaires et aux tarifs membres.`,
        },
        ...(d.amount ? [{ t: "details" as const, rows: [["Formule", d.planLabel], ["Montant", d.amount]] as Array<[string, string]> }] : []),
        { t: "button", label: "Renouveler mon adhésion", url: absUrl(ctx, d.renewUrl, "/espace/moi") },
        { t: "note", text: "Le paiement en plusieurs fois reste possible. Déjà renouvelé ? Ignore ce message." },
      ],
      reason: "Tu reçois cet e-mail parce que ton adhésion au Nomad Club arrive à échéance.",
    };
  },
});

const contractAccepted = define({
  id: "contract_accepted",
  label: "Contrat accepté",
  description: "Copie du contrat accepté (PDF joint par le chantier contrats).",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s(), contractTitle: s("Contrat d’adhésion"), version: s(), acceptedAt: s(), reference: s(), sha256: s(), contractUrl: s("/espace/moi") }),
  sample: {
    firstName: "Inès",
    contractTitle: "Contrat d’adhésion Membre",
    version: "v1.0 (brouillon)",
    acceptedAt: "2 novembre 2026 à 10 h 42",
    reference: "CTR-2026-0042",
    sha256: "9f2c…41ab",
  },
  render: (d, ctx) => {
    const rows: Array<[string, string]> = [["Contrat", d.contractTitle]];
    if (d.version) rows.push(["Version", d.version]);
    if (d.acceptedAt) rows.push(["Accepté le", d.acceptedAt]);
    if (d.reference) rows.push(["Référence", d.reference]);
    if (d.sha256) rows.push(["Empreinte SHA-256", d.sha256]);
    return {
      subject: `Ton contrat : ${d.contractTitle}`,
      preheader: "La copie de ton contrat accepté est jointe à cet e-mail (PDF).",
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: "Ton contrat est enregistré" },
        { t: "p", text: "Merci ! Tu trouveras en pièce jointe la copie PDF du contrat que tu viens d’accepter. Il reste disponible à tout moment dans ton espace." },
        { t: "details", rows },
        { t: "button", label: "Voir mes contrats", url: absUrl(ctx, d.contractUrl, "/espace/moi") },
      ],
      reason: "Tu reçois cet e-mail parce que tu as accepté un contrat avec le Nomad Club.",
    };
  },
});

const teamInvite = define({
  id: "team_invite",
  label: "Invitation d’équipe",
  description: "Invitation dans l’équipe d’un établissement (espace partenaire ou pro).",
  essential: true,
  prefType: null,
  schema: z.object({ inviterName: s(), organizationName: s("un établissement"), spaceLabel: s("partenaire"), joined: b(), acceptUrl: s() }),
  sample: { inviterName: "Kenza", organizationName: "Bloom House", spaceLabel: "partenaire", joined: false, acceptUrl: "/connexion?suite=/partenaire" },
  render: (d, ctx) => {
    const space = d.spaceLabel === "pro" ? "/pro" : "/partenaire";
    return {
      subject: `${d.inviterName || "On"} t’invite dans l’équipe de ${d.organizationName}`,
      preheader: `Rejoins l’espace ${d.spaceLabel} de ${d.organizationName} sur le Nomad Club.`,
      blocks: [
        { t: "p", text: "Bonjour," },
        { t: "h1", text: `Rejoins l’équipe de ${d.organizationName}` },
        {
          t: "p",
          text: `${d.inviterName || "La propriétaire de l’établissement"} t’a ajoutée à l’équipe de ${d.organizationName} sur l’appli du Nomad Club. Tu pourras gérer la fiche, les offres et valider les codes des membres depuis l’espace ${d.spaceLabel}.`,
        },
        {
          t: "p",
          text: d.joined
            ? "Ton compte existait déjà : ton espace est ouvert, il suffit de te connecter."
            : "Connecte-toi avec cette adresse e-mail (un lien de connexion t’est envoyé, sans mot de passe) : tu rejoindras l’équipe automatiquement.",
        },
        { t: "button", label: d.joined ? "Ouvrir mon espace" : "Accepter l’invitation", url: absUrl(ctx, d.acceptUrl || `/connexion?suite=${space}`) },
        { t: "note", text: "Tu ne connais pas cet établissement ? Ignore simplement cet e-mail : rien ne se passera sans connexion." },
      ],
      reason: "Tu reçois cet e-mail parce qu’une adresse t’a invitée sur l’appli du Nomad Club.",
    };
  },
});

const groupJoined = define({
  id: "group_joined",
  label: "Adhésion à un groupe acceptée",
  description: "Demande pour rejoindre un groupe thématique acceptée.",
  essential: false,
  prefType: "group_joined",
  schema: z.object({ firstName: s(), groupName: s(), title: s(), body: s(), link: s("/espace/cercle") }),
  sample: { firstName: "Inès", groupName: "Entrepreneuses de la tech", link: "/espace/cercle" },
  render: (d, ctx) => {
    const group = d.groupName || d.title.replace(/^.*:\s*/, "") || "le groupe";
    return {
      subject: d.groupName ? `Bienvenue dans le groupe « ${d.groupName} »` : d.title || "Ta demande de groupe est acceptée",
      preheader: "Ta demande est acceptée : tu peux écrire dans le groupe.",
      blocks: [
        { t: "p", text: hello(d.firstName) },
        { t: "h1", text: "Ta demande est acceptée" },
        { t: "p", text: d.body || `Tu fais maintenant partie de « ${group} ». Présente-toi en quelques mots aux autres membres !` },
        { t: "button", label: "Ouvrir le groupe", url: absUrl(ctx, d.link, "/espace/cercle") },
      ],
      reason: "Tu reçois cet e-mail parce que tu as demandé à rejoindre un groupe du cercle.",
    };
  },
});

const moderationWarning = define({
  id: "moderation_warning",
  label: "Avertissement de modération",
  description: "Avertissement sur un message (charte du cercle).",
  essential: false,
  prefType: "moderation_warning",
  schema: z.object({ firstName: s(), body: s(), excerpt: s(), title: s(), link: s("/espace/cercle") }),
  sample: {
    firstName: "Inès",
    body: "Ton message dans le salon contenait un lien commercial non sollicité. Merci de passer par l’espace Business pour ce type de proposition.",
    excerpt: "Profitez de -50 % sur mes coachings, lien en bio…",
  },
  render: (d, ctx) => ({
    subject: "Un mot de la modération du Nomad Club",
    preheader: "À propos de l’un de tes messages dans le cercle.",
    blocks: [
      { t: "p", text: hello(d.firstName) },
      { t: "h1", text: "Un mot de la modération" },
      { t: "p", text: d.body || "L’un de tes messages ne respecte pas la charte du cercle. Merci d’y prêter attention." },
      ...(d.excerpt ? [{ t: "quote" as const, text: d.excerpt }] : []),
      { t: "p", text: "Le cercle reste un espace bienveillant et sans démarchage grâce à chacune. Une question ? Réponds simplement à cet e-mail." },
      { t: "button", label: "Revoir le cercle", url: absUrl(ctx, d.link, "/espace/cercle") },
    ],
    reason: "Tu reçois cet e-mail parce que la modération a émis un avertissement sur l’un de tes messages.",
  }),
});

const dataExportReady = define({
  id: "data_export_ready",
  label: "Export de données prêt",
  description: "Export RGPD des données personnelles (sécurité).",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s(), requestedAt: s(), downloadUrl: s("/espace/moi/donnees") }),
  sample: { firstName: "Inès", requestedAt: "2 novembre 2026 à 10 h 42", downloadUrl: "/espace/moi/donnees" },
  render: (d, ctx) => ({
    subject: "Ton export de données personnelles",
    preheader: "Ton fichier est prêt dans ton espace.",
    blocks: [
      { t: "p", text: hello(d.firstName) },
      { t: "h1", text: "Ton export est prêt" },
      { t: "p", text: `L’export de tes données personnelles${d.requestedAt ? ` (demandé le ${d.requestedAt})` : ""} est disponible. Il contient ton profil, tes réservations, paiements, messages et préférences, au format JSON.` },
      { t: "button", label: "Retrouver mes données", url: absUrl(ctx, d.downloadUrl, "/espace/moi/donnees") },
      { t: "note", text: "Tu n’es pas à l’origine de cette demande ? Déconnecte tous tes appareils depuis « Mes données » et préviens-nous en répondant à cet e-mail." },
    ],
    reason: "E-mail de sécurité : envoyé à chaque export de données de ton compte.",
  }),
});

const deletionScheduled = define({
  id: "account_deletion_scheduled",
  label: "Suppression de compte programmée",
  description: "Demande de suppression enregistrée (délai de grâce de 30 jours).",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s(), scheduledFor: s(), cancelUrl: s("/espace/moi/donnees") }),
  sample: { firstName: "Chloé", scheduledFor: "2 décembre 2026" },
  render: (d, ctx) => ({
    subject: "Ta demande de suppression de compte",
    preheader: d.scheduledFor ? `Ton compte sera supprimé à partir du ${d.scheduledFor}.` : "Ta demande est enregistrée.",
    blocks: [
      { t: "p", text: hello(d.firstName) },
      { t: "h1", text: "Ta demande est enregistrée" },
      {
        t: "p",
        text: `Ton compte sera supprimé${d.scheduledFor ? ` à partir du ${d.scheduledFor}` : " dans 30 jours"}. Tes coordonnées, messages et préférences seront effacés ; les paiements et réservations sont conservés de façon anonyme (obligations comptables).`,
      },
      { t: "p", text: "Tu as changé d’avis ? Tu peux annuler jusqu’à cette date." },
      { t: "button", label: "Annuler la suppression", url: absUrl(ctx, d.cancelUrl, "/espace/moi/donnees") },
      { t: "note", text: "Tu n’es pas à l’origine de cette demande ? Annule-la et réponds à cet e-mail pour nous prévenir." },
    ],
    reason: "E-mail de sécurité concernant ton compte.",
  }),
});

const accountDeleted = define({
  id: "account_deleted",
  label: "Compte supprimé",
  description: "Confirmation de la suppression (anonymisation) du compte.",
  essential: true,
  prefType: null,
  schema: z.object({ firstName: s(), deletedAt: s() }),
  sample: { firstName: "Chloé", deletedAt: "2 décembre 2026" },
  render: (d) => ({
    subject: "Ton compte Nomad Club est supprimé",
    preheader: "Tes données personnelles ont été effacées.",
    blocks: [
      { t: "p", text: hello(d.firstName) },
      { t: "h1", text: "Ton compte est supprimé" },
      { t: "p", text: `Comme demandé, ton compte a été supprimé${d.deletedAt ? ` le ${d.deletedAt}` : ""}. Tes coordonnées, messages, notifications et préférences sont effacés. Seuls les paiements et réservations sont conservés, sans ton nom, pour la comptabilité.` },
      { t: "p", text: "Merci d’avoir fait partie du cercle. La porte reste ouverte : tu peux créer un nouveau compte quand tu veux." },
    ],
    reason: "Dernier e-mail envoyé à cette adresse : nous ne la conservons pas.",
  }),
});

const newsPublished = define({
  id: "news_published",
  label: "Nouvelle actualité",
  description: "Résumé d’une publication des fondatrices.",
  essential: false,
  prefType: "news_published",
  schema: z.object({ firstName: s(), title: s("Nouvelle publication"), excerpt: s(), body: s(), link: s("/espace/actualites") }),
  sample: {
    firstName: "Inès",
    title: "Le programme de décembre est en ligne",
    excerpt: "Iftar à la villa Yemna, atelier finances et un padel de fin d’année : voici tout ce qui vous attend ce mois-ci au club.",
    link: "/espace/actualites",
  },
  render: (d, ctx) => ({
    subject: d.title,
    preheader: (d.excerpt || d.body).slice(0, 140),
    blocks: [
      { t: "p", text: hello(d.firstName) },
      { t: "h1", text: "Du nouveau au club" },
      { t: "quote", title: d.title, text: d.excerpt || d.body },
      { t: "button", label: "Lire la suite", url: absUrl(ctx, d.link, "/espace/actualites") },
    ],
    reason: "Tu reçois cet e-mail parce que les actualités du club sont activées dans tes notifications.",
  }),
});

const notification = define({
  id: "notification",
  label: "Notification (modèle générique)",
  description: "Relais e-mail des autres notifications (accès, achats, parrainage, deals, tâches…).",
  essential: false,
  prefType: null,
  schema: z.object({ firstName: s(), title: s("Nouvelle notification"), body: s(), link: s(), notificationType: s() }),
  sample: { firstName: "Loubna", title: "Nouvel accès : Pro", body: "Les fondatrices ont ouvert un nouvel accès sur ton compte.", link: "/pro", notificationType: "role_changed" },
  prefTypeOf: (d) => d.notificationType || null,
  render: (d, ctx) => ({
    subject: d.title,
    preheader: d.body.slice(0, 140),
    blocks: [
      { t: "p", text: hello(d.firstName) },
      { t: "h1", text: d.title },
      ...(d.body ? [{ t: "p" as const, text: d.body }] : []),
      ...(d.link ? [{ t: "button" as const, label: "Ouvrir dans l’appli", url: absUrl(ctx, d.link) }] : []),
    ],
    reason: "Tu reçois cet e-mail parce que ce type de notification est activé par e-mail.",
  }),
});

export const TEMPLATES: Record<TemplateId, EmailTemplate> = {
  welcome,
  booking_confirmed: bookingConfirmed,
  waitlist_released: waitlistReleased,
  event_reminder: eventReminder,
  event_published: eventPublished,
  payment_receipt: paymentReceipt,
  payment_failed: paymentFailed,
  renewal_reminder: renewalReminder,
  contract_accepted: contractAccepted,
  team_invite: teamInvite,
  group_joined: groupJoined,
  moderation_warning: moderationWarning,
  data_export_ready: dataExportReady,
  account_deletion_scheduled: deletionScheduled,
  account_deleted: accountDeleted,
  news_published: newsPublished,
  notification,
};
