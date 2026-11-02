// Vérification des variables d'environnement du mode réel (présence et format), sans rien appeler.
// Utilisé par scripts/check-env.mjs (npm run check:env) et par le test du mode réel.

const b64json = (part) => {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};
/** Charge utile d'un JWT Supabase (clé anon / service_role historiques), ou null. */
export function jwtPayload(token) {
  const parts = String(token ?? "").split(".");
  return parts.length === 3 ? b64json(parts[1]) : null;
}

const isUrl = (v) => {
  try {
    return Boolean(new URL(v));
  } catch {
    return false;
  }
};

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ production?: boolean }} opts
 * @returns {{ errors: string[], warnings: string[], ok: string[] }}
 */
export function checkEnv(env, opts = {}) {
  const errors = [];
  const warnings = [];
  const ok = [];
  const v = (k) => (env[k] ?? "").trim();
  const prod = opts.production ?? false;

  // --- Supabase (obligatoire) ---
  const url = v("NEXT_PUBLIC_SUPABASE_URL");
  let ref = null;
  if (!url) errors.push("NEXT_PUBLIC_SUPABASE_URL manquante (Supabase → Project Settings → API → Project URL).");
  else if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url) && !(isUrl(url) && url.startsWith("https://")))
    errors.push(`NEXT_PUBLIC_SUPABASE_URL invalide : attendu https://xxxxxxxxxxxxxxxxxxxx.supabase.co (reçu « ${url} »).`);
  else {
    ref = url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/)?.[1] ?? null;
    if (url.endsWith("/")) warnings.push("NEXT_PUBLIC_SUPABASE_URL : retirer la barre oblique finale.");
    ok.push(`Supabase : ${new URL(url).host}`);
  }

  const checkKey = (name, role, prefix) => {
    const key = v(name);
    if (!key) {
      errors.push(`${name} manquante (Supabase → Project Settings → API).`);
      return;
    }
    if (key.startsWith(prefix)) {
      ok.push(`${name} : clé ${prefix}… présente`);
      return;
    }
    const p = jwtPayload(key);
    if (!p) {
      errors.push(`${name} : format inconnu (attendu une clé « ${prefix}… » ou un JWT « eyJ… »).`);
      return;
    }
    if (p.role !== role) errors.push(`${name} : cette clé a le rôle « ${p.role} » au lieu de « ${role} » (clés inversées ?).`);
    else if (ref && p.ref && p.ref !== ref) errors.push(`${name} : la clé appartient au projet « ${p.ref} », pas à « ${ref} ».`);
    else ok.push(`${name} : rôle ${role}${p.ref ? `, projet ${p.ref}` : ""}`);
  };
  checkKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon", "sb_publishable_");
  checkKey("SUPABASE_SERVICE_ROLE_KEY", "service_role", "sb_secret_");
  if (v("SUPABASE_SERVICE_ROLE_KEY") && v("SUPABASE_SERVICE_ROLE_KEY") === v("NEXT_PUBLIC_SUPABASE_ANON_KEY")) errors.push("SUPABASE_SERVICE_ROLE_KEY est identique à la clé publique.");
  for (const k of Object.keys(env)) if (k.startsWith("NEXT_PUBLIC_") && /SERVICE|SECRET|PRIVATE/.test(k)) errors.push(`${k} : une clé secrète ne doit JAMAIS commencer par NEXT_PUBLIC_ (elle serait envoyée aux navigateurs).`);

  // --- Site ---
  const site = v("NEXT_PUBLIC_SITE_URL");
  if (!site) errors.push("NEXT_PUBLIC_SITE_URL manquante (adresse publique du site, utilisée dans les liens de connexion et les e-mails).");
  else if (!isUrl(site)) errors.push(`NEXT_PUBLIC_SITE_URL invalide : « ${site} ».`);
  else if (prod && !site.startsWith("https://")) errors.push("NEXT_PUBLIC_SITE_URL doit être en https:// en production.");
  else if (prod && /localhost|127\.0\.0\.1/.test(site)) errors.push("NEXT_PUBLIC_SITE_URL pointe vers localhost en production.");
  else {
    if (site.endsWith("/")) warnings.push("NEXT_PUBLIC_SITE_URL : retirer la barre oblique finale.");
    ok.push(`Site : ${site}`);
  }

  // --- Mode démo ---
  const demo = v("NEXT_PUBLIC_DEMO");
  if (demo && !["true", "false"].includes(demo)) errors.push("NEXT_PUBLIC_DEMO : true ou false.");
  else if (demo !== "false") (prod ? errors : warnings).push("NEXT_PUBLIC_DEMO=false recommandé en production : interdit le sélecteur démo et les données d'exemple même si Supabase est mal configuré.");
  else ok.push("Mode démo interdit (NEXT_PUBLIC_DEMO=false)");

  // --- Tâches planifiées ---
  const cron = v("CRON_SECRET");
  if (!cron) errors.push("CRON_SECRET manquant (rappels J-1, purge sécurité) : 32 caractères aléatoires, ex. « openssl rand -hex 32 ».");
  else if (cron.length < 16) errors.push("CRON_SECRET trop court (16 caractères au moins).");
  else ok.push("CRON_SECRET présent");

  // --- Paiement ---
  const sk = v("STRIPE_SECRET_KEY");
  if (sk) {
    if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(sk)) errors.push("STRIPE_SECRET_KEY : format attendu sk_test_… ou sk_live_….");
    else {
      ok.push(`Stripe : clé ${sk.includes("_live_") ? "LIVE" : "de test"}`);
      if (prod && sk.includes("_test_")) warnings.push("STRIPE_SECRET_KEY est une clé de TEST : aucun vrai paiement ne sera encaissé.");
    }
    const wh = v("STRIPE_WEBHOOK_SECRET");
    if (!wh) errors.push("STRIPE_WEBHOOK_SECRET manquant alors que Stripe est activé (Stripe → Développeurs → Webhooks).");
    else if (!/^whsec_[A-Za-z0-9]{10,}$/.test(wh)) errors.push("STRIPE_WEBHOOK_SECRET : format attendu whsec_….");
  } else {
    warnings.push("Stripe non configuré : les paiements passeront par virement déclaré, validé par les fondatrices.");
    if (!v("NEXT_PUBLIC_TRANSFER_IBAN")) warnings.push("NEXT_PUBLIC_TRANSFER_IBAN vide : l'IBAN du virement ne s'affichera pas.");
  }

  // --- E-mails ---
  const resend = v("RESEND_API_KEY");
  const from = v("EMAIL_FROM");
  if (!resend) warnings.push("RESEND_API_KEY absente : aucun e-mail de l'appli ne partira (invitations, réponses aux candidatures…). Les liens de connexion passent par le SMTP de Supabase.");
  else if (!/^re_[A-Za-z0-9_]{10,}$/.test(resend)) errors.push("RESEND_API_KEY : format attendu re_….");
  else ok.push("Resend : clé présente");
  if (resend && !from) errors.push("EMAIL_FROM manquant (ex. « Nomad Club <bonjour@votre-domaine.ma> »).");
  else if (from && !/^(.+<)?[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>?$/.test(from)) errors.push(`EMAIL_FROM invalide : « ${from} ».`);

  // --- Sécurité ---
  const mfa = v("ADMIN_MFA_REQUIRED");
  if (mfa === "false") warnings.push("ADMIN_MFA_REQUIRED=false : la double authentification des fondatrices est COUPÉE (dépannage seulement).");
  else if (mfa && mfa !== "true") errors.push("ADMIN_MFA_REQUIRED : true ou false.");
  const vapPub = v("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const vapPriv = v("VAPID_PRIVATE_KEY");
  if (Boolean(vapPub) !== Boolean(vapPriv)) errors.push("Clés VAPID : NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY vont ensemble (node scripts/vapid-keys.mjs).");
  else if (vapPub) {
    if (!/^[A-Za-z0-9_-]{80,90}$/.test(vapPub) || !/^[A-Za-z0-9_-]{40,46}$/.test(vapPriv)) errors.push("Clés VAPID : format inattendu (régénérer avec node scripts/vapid-keys.mjs).");
    else ok.push("Notifications push : clés VAPID présentes");
    const subj = v("VAPID_SUBJECT");
    if (subj && !/^(mailto:|https:\/\/)/.test(subj)) errors.push("VAPID_SUBJECT : commence par mailto: ou https://.");
  } else warnings.push("Notifications push désactivées (pas de clés VAPID).");

  // --- Surveillance ---
  for (const k of ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"]) {
    const dsn = v(k);
    if (dsn && !/^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test(dsn)) errors.push(`${k} : format attendu https://clé@o000.ingest.sentry.io/0000.`);
  }
  if (v("SENTRY_DSN") || v("NEXT_PUBLIC_SENTRY_DSN")) ok.push("Sentry : activé");
  else warnings.push("Surveillance des erreurs désactivée (SENTRY_DSN absent) : les erreurs restent dans les journaux Vercel.");

  const maint = v("MAINTENANCE_MODE");
  if (maint && !["true", "false"].includes(maint)) errors.push("MAINTENANCE_MODE : true ou false.");
  if (maint === "true") warnings.push("MAINTENANCE_MODE=true : le site affiche la page de maintenance.");
  const cur = v("NEXT_PUBLIC_CURRENCY");
  if (cur && !/^[A-Z]{3}$/.test(cur)) errors.push("NEXT_PUBLIC_CURRENCY : code ISO à 3 lettres (USD, EUR, MAD).");

  return { errors, warnings, ok };
}
