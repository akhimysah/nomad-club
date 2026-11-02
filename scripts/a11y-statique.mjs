// Contrôles d'accessibilité statiques sur le HTML rendu par le serveur (sans navigateur) :
// lang, un seul h1 et pas de saut de niveau, images avec alt, champs étiquetés, boutons et liens nommés.
// À lancer comme scripts/parcours-reel.mjs (appli en mode réel branchée sur scripts/faux-supabase.mjs).
//   node scripts/a11y-statique.mjs [http://localhost:3204] [http://localhost:54329]
// Ne remplace pas un essai au lecteur d'écran (VoiceOver, TalkBack) : voir docs/lancement/accessibilite.md.
const APP = process.argv[2] ?? "http://localhost:3204";
const SUPA = process.argv[3] ?? "http://localhost:54329";
const sess = async (q) => (await fetch(`${SUPA}/__session?${q}`)).text();
const H = await sess("profil=p-hana");
const J = await sess("email=julia@exemple.com");
const I = await sess("email=ines@exemple.com");
const pages = [
  ["/", null], ["/rendez-vous", null], ["/club", null], ["/inscription", null], ["/inscription?parcours=adhesion", null], ["/connexion", null], ["/cgu", null], ["/statut", null], ["/formules", null],
  ["/nexiste-pas", null], ["/maintenance", null], ["/configuration-manquante", null],
  ["/candidature", H], ["/bienvenue?etape=profile", H], ["/bienvenue?etape=privacy", H], ["/bienvenue?etape=notifications", H], ["/bienvenue?etape=install", H],
  ["/bienvenue?etape=profile", I], ["/fondatrices/candidatures", J], ["/fondatrices/roles", J],
];
let issues = 0;
for (const [path, cookie] of pages) {
  const html = await (await fetch(APP + path, { headers: cookie ? { cookie } : {} })).text();
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const out = [];
  if (!/<html[^>]*lang="fr"/.test(html)) out.push("html sans lang=fr");
  const imgs = [...body.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).filter((t) => !/\balt=/.test(t));
  if (imgs.length) out.push(`${imgs.length} img sans alt`);
  const ids = new Set([...body.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  const inputs = [...body.matchAll(/<(input|select|textarea)\b([^>]*)>/g)].filter((m) => !/type="(hidden|submit|button)"/.test(m[2]));
  for (const m of inputs) {
    const id = m[2].match(/\bid="([^"]+)"/)?.[1];
    const aria = /aria-label(ledby)?=/.test(m[2]);
    // champ enveloppé dans un <label> : on regarde les 400 caractères précédents
    const idx = body.indexOf(m[0]);
    const wrapped = /<label\b(?![\s\S]*<\/label>)[\s\S]*$/.test(body.slice(Math.max(0, idx - 600), idx));
    if (!aria && !(id && ids.has(id)) && !wrapped) out.push(`champ sans étiquette: ${m[0].slice(0, 90)}`);
  }
  const h1 = (body.match(/<h1\b/g) ?? []).length;
  if (h1 !== 1) out.push(`${h1} h1`);
  const levels = [...body.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) { out.push(`saut de titre h${levels[i - 1]}→h${levels[i]}`); break; }
  const btns = [...body.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].filter((m) => !/aria-label=/.test(m[0]) && !m[1].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").trim());
  if (btns.length) out.push(`${btns.length} bouton(s) sans nom`);
  const links = [...body.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].filter((m) => !/aria-label=/.test(m[0]) && !m[1].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<img[^>]*alt="([^"]+)"[^>]*>/g, "$1").replace(/<[^>]+>/g, "").trim());
  if (links.length) out.push(`${links.length} lien(s) sans nom`);
  issues += out.length;
  console.log(`${out.length ? "✗" : "✓"} ${path}${cookie ? " (connectée)" : ""}${out.length ? "\n    " + out.join("\n    ") : ""}`);
}
console.log(`\n${issues} problème(s)`);
process.exit(issues ? 1 : 0);
