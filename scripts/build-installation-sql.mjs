// Regroupe supabase/migrations/*.sql en un seul script pour une base Supabase neuve
// (à coller dans SQL Editor). Utilisation : npm run sql:installation
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
let out =
  "-- Nomad Club : installation complète d'une base Supabase NEUVE (" + files[0].slice(0, 4) + " à " + files.at(-1).slice(0, 4) + ").\n" +
  "-- À coller tel quel dans Supabase > SQL Editor > New query, puis Run. Aucune donnée d'exemple.\n" +
  "-- Généré par « npm run sql:installation » depuis supabase/migrations/ : ne pas modifier à la main.\n";
for (const f of files) out += `\n-- ===================== ${f} =====================\n` + readFileSync(join(dir, f), "utf8") + "\n";
mkdirSync(join(root, "supabase/installation"), { recursive: true });
writeFileSync(join(root, "supabase/installation/base-neuve.sql"), out);
console.log(`supabase/installation/base-neuve.sql : ${files.length} migrations`);
