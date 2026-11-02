// Vérifie les variables nécessaires au MODE RÉEL (présence et format), sans appeler aucun service.
//
//   npm run check:env                      → .env.local puis .env, sous l'environnement courant
//   npm run check:env -- --file chemin     → un fichier précis (ex. variables copiées depuis Vercel)
//   npm run check:env -- --production      → règles de production (https, démo interdite…)
//
// Code de sortie 1 s'il y a au moins une erreur. Aucune valeur secrète n'est affichée.
import { join, resolve } from "node:path";
import { checkEnv } from "./lib/check-env-core.mjs";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { root } from "./lib/pglite-db.mjs";

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const files = fileIdx >= 0 ? [resolve(process.cwd(), args[fileIdx + 1] ?? "")] : [join(root, ".env.local"), join(root, ".env")];
const production = args.includes("--production") || process.env.VERCEL_ENV === "production";

const { vars, used } = loadEnvFiles(files);
// un fichier précis est vérifié seul ; sinon l'environnement courant (Vercel, CI) a la priorité
const env = fileIdx >= 0 ? vars : { ...vars, ...process.env };
if (fileIdx >= 0 && !used.length) {
  console.error(`✗ Fichier introuvable : ${files[0]}`);
  process.exit(1);
}

const { errors, warnings, ok } = checkEnv(env, { production });
console.log(`Variables du mode réel${production ? " (production)" : ""} — ${used.length ? used.map((f) => f.replace(root + "/", "")).join(", ") : "environnement courant"}\n`);
for (const m of ok) console.log(`  ✓ ${m}`);
for (const m of warnings) console.log(`  ! ${m}`);
for (const m of errors) console.log(`  ✗ ${m}`);
console.log(`\n${errors.length} erreur${errors.length > 1 ? "s" : ""}, ${warnings.length} avertissement${warnings.length > 1 ? "s" : ""}.`);
process.exit(errors.length ? 1 : 0);
