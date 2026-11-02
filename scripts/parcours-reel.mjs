// Parcourt les pages de l'appli en MODE RÉEL, pour chaque personnage, et signale les erreurs.
// À lancer avec le faux Supabase (node scripts/faux-supabase.mjs) et l'appli branchée dessus
// (voir l'en-tête de scripts/faux-supabase.mjs). Développement uniquement.
//
//   node scripts/parcours-reel.mjs [http://localhost:3204] [http://localhost:54329]
const APP = process.argv[2] ?? "http://localhost:3204";
const SUPA = process.argv[3] ?? "http://localhost:54329";

const PERSONAS = {
  visiteuse: { email: null, pages: ["/", "/rendez-vous", "/club", "/formules", "/inscription", "/inscription?parcours=adhesion", "/connexion", "/cgu", "/confidentialite", "/mentions-legales", "/statut"] },
  "compte gratuit (Hana)": { email: "profil:p-hana", pages: ["/", "/formules", "/connexion", "/candidature", "/bienvenue", "/bienvenue?etape=privacy", "/bienvenue?etape=notifications", "/bienvenue?etape=install", "/mes-donnees"] },
  "membre (Inès)": {
    email: "ines@exemple.com",
    pages: ["/espace", "/espace/agenda", "/espace/cercle", "/espace/cercle/groupes", "/espace/carnet", "/espace/offres", "/espace/carte", "/espace/actualites", "/espace/moi", "/espace/moi/profil", "/espace/moi/donnees", "/espace/notifications", "/espace/boutique", "/espace/boutique/mes-ressources", "/espace/parrainage", "/espace/business", "/espace/assistant", "/bienvenue?etape=profile", "/candidature"],
  },
  "partenaire (Kenza)": { email: "kenza@exemple.com", pages: ["/partenaire", "/partenaire/offres", "/partenaire/offres/nouvelle", "/partenaire/valider", "/partenaire/statistiques", "/partenaire/etablissement", "/partenaire/notifications"] },
  "pro (Loubna)": { email: "loubna@exemple.com", pages: ["/pro", "/pro/fiche", "/pro/abonnement", "/pro/statistiques", "/pro/notifications"] },
  "admin (Julia)": {
    email: "julia@exemple.com",
    pages: [
      "/fondatrices",
      "/fondatrices/a-traiter",
      "/fondatrices/membres",
      "/fondatrices/candidatures",
      "/fondatrices/evenements",
      "/fondatrices/encaissements",
      "/fondatrices/communaute",
      "/fondatrices/communaute/actualites",
      "/fondatrices/communaute/groupes",
      "/fondatrices/communaute/moderation",
      "/fondatrices/crm",
      "/fondatrices/crm/contacts",
      "/fondatrices/crm/pipeline",
      "/fondatrices/crm/taches",
      "/fondatrices/crm/segments",
      "/fondatrices/crm/statistiques",
      "/fondatrices/crm/import",
      "/fondatrices/roles",
      "/fondatrices/journal",
      "/fondatrices/notifications",
      "/fondatrices/boutique",
      "/fondatrices/parrainage",
      "/fondatrices/business",
      "/fondatrices/securite",
      "/fondatrices/plus",
      "/partenaire",
      "/pro",
      "/espace",
    ],
  },
};

const ERROR_MARKERS = ["Quelque chose s’est mal passé", "L’appli a rencontré un problème", "Application error", "Unhandled Runtime Error", "Internal Server Error"];
let bad = 0;
let total = 0;
for (const [name, p] of Object.entries(PERSONAS)) {
  let cookie = "";
  if (p.email) {
    const q = p.email.startsWith("profil:") ? `profil=${p.email.slice(7)}` : `email=${encodeURIComponent(p.email)}`;
    const r = await fetch(`${SUPA}/__session?${q}`);
    if (!r.ok) {
      console.log(`✗ ${name} : pas de compte ${p.email} dans la base`);
      bad++;
      continue;
    }
    cookie = await r.text();
  }
  console.log(`\n${name}`);
  for (const path of p.pages) {
    total++;
    const res = await fetch(`${APP}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    const marker = ERROR_MARKERS.find((m) => html.includes(m));
    const okStatus = res.status === 200 || (res.status >= 300 && res.status < 400);
    const where = res.status >= 300 && res.status < 400 ? ` → ${res.headers.get("location")}` : "";
    if (!okStatus || marker) {
      bad++;
      console.log(`  ✗ ${res.status} ${path}${where}${marker ? ` (« ${marker} »)` : ""}`);
    } else console.log(`  ✓ ${res.status} ${path}${where}`);
  }
}
console.log(`\n${total - bad} page(s) sans erreur, ${bad} problème(s).`);
process.exit(bad ? 1 : 0);
