// Vague 2 · Contrats — SQL des modèles initiaux (version 1) à partir de src/lib/modules/contrats/templates.ts.
// Utilisation : node scripts/contrats-templates-sql.mjs          → affiche le bloc
//               node scripts/contrats-templates-sql.mjs --write  → le remplace dans supabase/migrations/0010_contrats.sql
// npm run test:sql vérifie que la migration et templates.ts contiennent les mêmes textes.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { INITIAL_TEMPLATES } = await import(join(root, "src/lib/modules/contrats/templates.ts"));

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const dollar = (s) => {
  if (s.includes("$modele$")) throw new Error("Le texte contient le délimiteur $modele$.");
  return `$modele$${s}$modele$`;
};

export function templatesSql() {
  const rows = INITIAL_TEMPLATES.map(
    (t) =>
      `insert into public.contract_templates (id, kind, version, title, body_md, effective_from, is_active, notes, activated_at)\nvalues (${q(t.id)}, ${q(t.kind)}, ${t.version}, ${q(t.title)}, ${dollar(t.bodyMd)}, ${q(t.effectiveFrom)}, true, 'Version initiale (brouillon à faire valider par un juriste).', ${q(t.effectiveFrom + "T08:00:00Z")})\non conflict (id) do nothing;`,
  );
  return rows.join("\n\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sql = templatesSql();
  if (process.argv.includes("--write")) {
    const file = join(root, "supabase/migrations/0010_contrats.sql");
    const src = readFileSync(file, "utf8");
    const out = src.replace(/-- <modeles-initiaux>[\s\S]*-- <\/modeles-initiaux>/, () => `-- <modeles-initiaux>\n${sql}\n-- </modeles-initiaux>`);
    writeFileSync(file, out);
    console.log("Modèles initiaux écrits dans 0010_contrats.sql");
  } else console.log(sql);
}
