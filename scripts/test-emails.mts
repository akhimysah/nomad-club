// Vague 2 · E-mails — tests sans serveur : rendu de chaque modèle (HTML + texte), règles du canal e-mail
// des notifications (préférences, essentiels), liens de désinscription, fournisseurs Resend et console.
// Utilisation : npm run test:emails (Node 22 : --experimental-strip-types)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = (p: string) => import(`${root}/src/lib/modules/emails/${p}`);
const { TEMPLATES, TICKET_QR_CID } = await mod("templates.ts");
const { renderEmail } = await mod("render.ts");
const { TEMPLATE_IDS } = await mod("types.ts");
const channel = await mod("channel.ts");
const unsub = await mod("unsubscribe.ts");
const config = await mod("config.ts");
const resend = await mod("mailers/resend.ts");
const consoleMailer = await mod("mailers/console.ts");

let fail = 0;
let pass = 0;
const ok = (c: boolean, m: string) => {
  if (c) pass++;
  else fail++;
  console.log(`${c ? "✓" : "✗"} ${m}`);
};

const BASE = "https://nomadclub.test";
const UNSUB = `${BASE}/e-mails/desinscription?t=abc`;
type Rendered = { subject: string; html: string; text: string; essential: boolean; prefType: string | null };

console.log("\nModèles : rendu avec les données d'exemple");
const required = [
  "booking_confirmed",
  "waitlist_released",
  "event_reminder",
  "event_published",
  "payment_receipt",
  "payment_failed",
  "renewal_reminder",
  "contract_accepted",
  "team_invite",
  "group_joined",
  "moderation_warning",
  "data_export_ready",
  "account_deletion_scheduled",
  "account_deleted",
  "news_published",
  "welcome",
];
ok(required.every((id) => TEMPLATE_IDS.includes(id)), `les ${required.length} modèles demandés existent`);
ok(Object.keys(TEMPLATES).length === TEMPLATE_IDS.length, "chaque identifiant a son modèle");

for (const id of TEMPLATE_IDS as string[]) {
  const t = TEMPLATES[id];
  let r: Rendered | null = null;
  try {
    r = renderEmail(id, t.sample, { baseUrl: BASE, unsubscribeUrl: UNSUB, inline: { [TICKET_QR_CID]: `cid:${TICKET_QR_CID}` } });
  } catch (e) {
    ok(false, `${id} : rendu sans erreur (${e instanceof Error ? e.message : e})`);
    continue;
  }
  const bad = /undefined|\[object Object\]|NaN|null/;
  const clean = !bad.test(r.subject) && !bad.test(r.text) && !bad.test(r.html.replace(/<[^>]+>/g, ""));
  const html = r.html.startsWith("<!DOCTYPE html>") && r.html.includes('lang="fr"') && r.html.includes("/img/logotype-clair.png") && r.html.includes("<table");
  const unsubOk = r.essential ? !r.html.includes(UNSUB) && !r.text.includes(UNSUB) : r.html.includes("Ne plus recevoir ces e-mails") && r.text.includes(UNSUB);
  ok(Boolean(r.subject) && html && r.text.length > 80 && clean && unsubOk, `${id} : « ${r.subject} » (HTML ${Math.round(r.html.length / 1024)} ko, texte ${r.text.length} car., ${r.essential ? "essentiel" : "désinscription"})`);
  // données vides : pas d'erreur, pas de « undefined »
  try {
    const e = renderEmail(id, {}, { baseUrl: BASE });
    ok(Boolean(e.subject) && !/undefined|\[object Object\]/.test(e.html + e.text), `${id} : données manquantes tolérées`);
  } catch (e) {
    ok(false, `${id} : données manquantes tolérées (${e instanceof Error ? e.message : e})`);
  }
}

const booking = renderEmail("booking_confirmed", TEMPLATES.booking_confirmed.sample, { baseUrl: BASE, inline: { [TICKET_QR_CID]: `cid:${TICKET_QR_CID}` } }) as Rendered;
ok(booking.html.includes(`src="cid:${TICKET_QR_CID}"`) && booking.html.includes("K7Q2MX") && booking.text.includes(`${BASE}/billet/K7Q2MX`), "billet : code, QR intégré (cid) et lien dans la version texte");
ok(booking.essential && !booking.html.includes("Ne plus recevoir"), "billet : essentiel, sans lien de désinscription");
const xss = renderEmail("welcome", { firstName: '<script>alert("x")</script>' }, { baseUrl: BASE }) as Rendered;
ok(!xss.html.includes("<script>") && xss.html.includes("&lt;script&gt;"), "les données sont échappées dans le HTML");
const js = renderEmail("notification", { title: "T", link: "javascript:alert(1)" }, { baseUrl: BASE }) as Rendered;
ok(!/href="javascript:/i.test(js.html), "les liens non http(s) sont neutralisés");
const rel = renderEmail("waitlist_released", { eventUrl: "/rendez-vous/x" }, { baseUrl: BASE + "/" }) as Rendered;
ok(rel.html.includes(`${BASE}/rendez-vous/x`), "les liens internes deviennent absolus");
const r30 = renderEmail("renewal_reminder", { daysLeft: 30 }, { baseUrl: BASE }) as Rendered;
const r1 = renderEmail("renewal_reminder", { daysLeft: 1 }, { baseUrl: BASE }) as Rendered;
ok(r30.subject.includes("30 jours") && r1.subject.includes("demain"), "renouvellement : objet J-30 / J-1");
const generic = renderEmail("notification", { title: "Nouvel accès", notificationType: "role_changed" }, { baseUrl: BASE, essential: true, unsubscribeUrl: UNSUB }) as Rendered;
ok(generic.essential && !generic.html.includes(UNSUB) && generic.prefType === "role_changed", "modèle générique : essentiel forcé (accès) sans désinscription");

console.log("\nCanal e-mail des notifications");
const recipients = new Map([
  ["ines", { email: "ines@exemple.com", firstName: "Inès" }],
  ["lou", { email: "lou@exemple.com", firstName: "Lou" }],
  ["sans", { email: null, firstName: "Sans" }],
]);
const row = (recipientId: string, type: string) => ({ recipientId, type, title: `Titre ${type}`, body: "Corps", link: "/espace" });
const prefs = [
  { profileId: "ines", type: "event_published", email: false },
  { profileId: "ines", type: "booking_confirmed", email: false },
  { profileId: "lou", type: "event_published", email: true },
];
const plan = channel.planNotificationEmails([row("ines", "event_published"), row("lou", "event_published"), row("sans", "event_published")], { prefs, recipients });
ok(plan.length === 1 && plan[0].to === "lou@exemple.com", "préférence e-mail coupée → pas d'e-mail ; sans adresse → pas d'e-mail");
const plan2 = channel.planNotificationEmails([row("ines", "news_published")], { prefs, recipients });
ok(plan2.length === 1 && plan2[0].template === "news_published", "préférence absente → e-mail envoyé (actif par défaut)");
const plan3 = channel.planNotificationEmails([row("ines", "booking_confirmed"), row("ines", "payment_validated"), row("ines", "role_changed")], {
  prefs: [...prefs, { profileId: "ines", type: "payment_validated", email: false }, { profileId: "ines", type: "role_changed", email: false }],
  recipients,
});
ok(plan3.length === 3 && plan3.every((p: { essential: boolean }) => p.essential), "billet, reçu et accès partent toujours (essentiels), même préférence coupée");
ok(plan3.map((p: { template: string }) => p.template).join() === "booking_confirmed,payment_receipt,notification", "modèles : billet, reçu, générique pour l'accès");
const plan4 = channel.planNotificationEmails([row("lou", "waitlist_spot"), row("lou", "deal_declared")], { prefs, recipients, extras: [{ eventTitle: "Dîner" }, undefined] });
ok(plan4[0].template === "waitlist_released" && plan4[0].data.eventTitle === "Dîner" && plan4[0].data.firstName === "Lou", "données riches fusionnées (liste d'attente)");
ok(plan4[1].template === "notification" && plan4[1].data.notificationType === "deal_declared", "type sans modèle dédié → modèle générique");
const mutedWaitlist = channel.planNotificationEmails([row("lou", "waitlist_spot")], { prefs: [{ profileId: "lou", type: "waitlist_spot", email: false }], recipients });
ok(mutedWaitlist.length === 0, "liste d'attente : préférence e-mail respectée");
for (const [type, tpl] of Object.entries(channel.NOTIFICATION_TEMPLATE) as Array<[string, string]>) {
  const t = TEMPLATES[tpl];
  if (!t.essential) ok(t.prefType === type, `${tpl} : la désinscription coupe la préférence « ${type} »`);
}

console.log("\nDésinscription");
const token = unsub.signUnsubscribe("p-ines", "event_published", "secret-1");
ok(JSON.stringify(unsub.verifyUnsubscribe(token, "secret-1")) === JSON.stringify({ profileId: "p-ines", type: "event_published" }), "jeton valide");
ok(unsub.verifyUnsubscribe(token, "secret-2") === null, "mauvais secret → refusé");
const [p] = token.split(".");
const forged = Buffer.from("p-julia:event_published").toString("base64url") + "." + token.split(".")[1];
ok(unsub.verifyUnsubscribe(forged, "secret-1") === null && unsub.verifyUnsubscribe(p, "secret-1") === null, "jeton modifié ou tronqué → refusé");
ok(unsub.verifyUnsubscribe(token, null) === null, "sans secret → refusé");

console.log("\nConfiguration et fournisseurs");
ok(config.emailProvider({}) === "console", "sans clé : fournisseur console");
ok(config.emailProvider({ RESEND_API_KEY: "re_test" }) === "resend", "RESEND_API_KEY → Resend");
ok(config.emailProvider({ RESEND_API_KEY: "re_test", EMAIL_PROVIDER: "console" }) === "console", "EMAIL_PROVIDER force le fournisseur");
ok(config.emailFrom({ EMAIL_FROM: "Nomad Club <bonjour@nomad.ma>" }) === "Nomad Club <bonjour@nomad.ma>" && config.emailFrom({}).includes("Nomad Club"), "EMAIL_FROM (repli par défaut)");
ok(config.unsubscribeSecret({ NODE_ENV: "production" }) === null && Boolean(config.unsubscribeSecret({ NODE_ENV: "production", CRON_SECRET: "x".repeat(32) })), "secret de désinscription : jamais de valeur par défaut en production");
ok(config.isEmailAddress("ines@exemple.com") && !config.isEmailAddress("pas une adresse") && !config.isEmailAddress("a@b"), "contrôle des adresses");
ok(config.maskEmail("chloe@gmail.com") === "c•••@gmail.com", "adresse masquée pour le journal");

const email = {
  from: "Nomad Club <bonjour@nomad.ma>",
  to: "ines@exemple.com",
  replyTo: "julia@nomad.ma",
  subject: "Objet",
  html: "<p>x</p>",
  text: "x",
  headers: { "List-Unsubscribe": "<https://x>" },
  attachments: [{ filename: "billet-qr.png", contentBase64: "AAAA", contentType: "image/png", contentId: "billet-qr" }],
  tags: { template: "booking_confirmed" },
  idempotencyKey: "cle-1",
};
const payload = resend.resendPayload(email);
ok(
  JSON.stringify(payload.to) === '["ines@exemple.com"]' &&
    payload.reply_to === "julia@nomad.ma" &&
    (payload.attachments as Array<{ content_id?: string }>)[0].content_id === "billet-qr" &&
    (payload.tags as Array<{ name: string }>)[0].name === "template",
  "Resend : corps de requête (destinataire, réponse, image intégrée, étiquettes)",
);
const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
const fakeFetch = async (url: string, init: { headers: Record<string, string>; body: string }) => {
  calls.push({ url, headers: init.headers, body: init.body });
  if (url.endsWith("/batch")) return { ok: true, status: 200, json: async () => ({ data: JSON.parse(init.body).map((_: unknown, i: number) => ({ id: `b${i}` })) }) };
  if (JSON.parse(init.body).to[0] === "refuse@exemple.com") return { ok: false, status: 422, json: async () => ({ name: "validation_error", message: "Adresse refusée" }) };
  return { ok: true, status: 200, json: async () => ({ id: "re_42" }) };
};
const m = resend.createResendMailer("re_test_cle", fakeFetch);
const r1s = await m.send(email);
ok(r1s.ok && r1s.id === "re_42" && calls[0].headers.Authorization === "Bearer re_test_cle" && calls[0].headers["Idempotency-Key"] === "cle-1", "Resend : envoi, clé et Idempotency-Key");
const r2s = await m.send({ ...email, to: "refuse@exemple.com" });
ok(!r2s.ok && r2s.error.includes("422") && r2s.error.includes("Adresse refusée"), "Resend : erreur renvoyée sans exception");
const batch = await m.sendBatch(Array.from({ length: 150 }, (_, i) => ({ ...email, to: `m${i}@exemple.com` })));
ok(batch.length === 150 && batch.every((x: { ok: boolean }) => x.ok) && calls.filter((c) => c.url.endsWith("/batch")).length === 2, "Resend : envoi groupé par lots de 100");
ok(!JSON.parse(calls.find((c) => c.url.endsWith("/batch"))!.body)[0].attachments, "Resend : pas de pièce jointe dans un lot");
const down = resend.createResendMailer("k", async () => {
  throw new Error("réseau coupé");
});
const r3s = await down.send(email);
ok(!r3s.ok && r3s.error.includes("injoignable"), "Resend injoignable : échec propre");

consoleMailer.clearConsoleOutbox();
const cm = consoleMailer.createConsoleMailer({ quiet: true });
await cm.send(email);
await cm.send({ ...email, subject: "Deuxième" });
const box = consoleMailer.consoleOutbox();
ok(box.length === 2 && box[0].email.subject === "Deuxième", "console : garde les derniers envois en mémoire (le plus récent d'abord)");

console.log(`\n${pass} vérification${pass > 1 ? "s" : ""} réussie${pass > 1 ? "s" : ""}, ${fail} échec${fail > 1 ? "s" : ""}.`);
process.exit(fail ? 1 : 0);
