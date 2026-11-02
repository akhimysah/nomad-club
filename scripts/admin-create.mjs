// Crée la première administratrice en mode réel (Supabase), avec la clé service.
//
//   npm run admin:create -- julia@exemple.com
//   npm run admin:create -- julia@exemple.com --prenom Julia
//   npm run admin:create -- nora@exemple.com --prenom Nora --force   (une admin existe déjà)
//
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement, puis .env.local / .env.
// Aucune clé n'est affichée. Le compte est créé confirmé (sans mot de passe : connexion par lien magique),
// le rôle « admin » est attribué et journalisé. La personne active ensuite sa double authentification.
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createAdmin } from "./lib/admin-create-core.mjs";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { root } from "./lib/pglite-db.mjs";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--prenom");
const prenomIdx = args.indexOf("--prenom");
const firstName = prenomIdx >= 0 ? (args[prenomIdx + 1] ?? null) : null;
const force = args.includes("--force");

if (!email || args.includes("--help") || args.includes("-h")) {
  console.log("Utilisation : npm run admin:create -- prenom@exemple.com [--prenom Julia] [--force]");
  process.exit(email ? 0 : 1);
}

const { vars } = loadEnvFiles([join(root, ".env.local"), join(root, ".env")]);
const env = { ...vars, ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires (dans .env.local ou l'environnement).");
  process.exit(1);
}
let host;
try {
  host = new URL(url).host;
} catch {
  console.error(`✗ NEXT_PUBLIC_SUPABASE_URL invalide : ${url}`);
  process.exit(1);
}
if (!url.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) {
  console.error("✗ L'adresse Supabase doit être en https:// (ou locale).");
  process.exit(1);
}

console.log(`Projet Supabase : ${host}`);
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const r = await createAdmin({ supabase, email, firstName, force });
  const site = (env.NEXT_PUBLIC_SITE_URL || "https://votre-site").replace(/\/$/, "");
  console.log(`
Étapes suivantes pour ${email} :
  1. Ouvrir ${site}/connexion et demander le lien de connexion.
  2. Accepter les conditions à la première connexion.
  3. Activer la double authentification : ${site}/connexion/double-authentification
     (l'espace Fondatrices l'exige en mode réel).${r.alreadyAdmin ? "" : "\n  4. Seconde fondatrice : elle crée son compte sur /inscription, puis Fondatrices → Rôles et accès → rôle Administratrice (ou relancer ce script avec --force)."}`);
  process.exit(0);
} catch (e) {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
