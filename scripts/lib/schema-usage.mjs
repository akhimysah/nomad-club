// Vérification statique : chaque table, colonne et fonction SQL citée par le code (appels supabase-js
// `.from("…")`, `.select("…")`, filtres, clés des objets insérés / modifiés, `.rpc("…", { … })`)
// existe dans le schéma obtenu après les migrations. Analyse textuelle volontairement simple :
// les noms calculés (variables, gabarits) sont ignorés ; le test d'intégration couvre l'exécution.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { root } from "./pglite-db.mjs";

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

/** Fin de l'expression chaînée qui commence à `start` (premier `;` ou `,`/`)` fermant au niveau 0). */
function chainEnd(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) {
      if (depth === 0) return i;
      depth--;
    } else if ((ch === ";" || ch === ",") && depth === 0) return i;
  }
  return src.length;
}

/** Contenu de l'objet littéral qui commence à `i` (`{`), ou null. */
function objectAt(src, i) {
  if (src[i] !== "{") return null;
  let depth = 0;
  let quote = null;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (quote) {
      if (ch === "\\") j++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) {
      depth--;
      if (depth === 0) return src.slice(i + 1, j);
    }
  }
  return null;
}

/** Clés de premier niveau d'un objet littéral (`a: …`, `b,` raccourci). */
function topKeys(body) {
  const keys = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  const flush = () => {
    const t = cur.trim();
    cur = "";
    if (!t || t.startsWith("...") || t.startsWith("[")) return;
    const m = t.match(/^["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*(:|$)/);
    if (m) keys.push(m[1]);
  };
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    if (quote) {
      cur += ch;
      if (ch === "\\") cur += body[++j] ?? "";
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) flush();
    else cur += ch;
  }
  flush();
  return keys;
}

function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export async function checkSchemaUsage(db) {
  const cols = (
    await db.query(`select c.relname as t, a.attname as c from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relkind in ('r','v','m','p') and a.attnum > 0 and not a.attisdropped`)
  ).rows;
  const tables = new Map();
  for (const r of cols) (tables.get(r.t) ?? tables.set(r.t, new Set()).get(r.t)).add(r.c);
  const fns = new Map();
  for (const f of (
    await db.query(`select p.proname as name, coalesce(p.proargnames, '{}') as names, coalesce(p.proargmodes::text[], '{}') as modes, p.pronargs as n, p.pronargdefaults as d
                      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public'`)
  ).rows) {
    const inNames = f.modes.length ? f.names.filter((_, i) => ["i", "b", "v"].includes(f.modes[i])) : f.names.slice(0, f.n);
    (fns.get(f.name) ?? fns.set(f.name, []).get(f.name)).push({ inNames, required: inNames.slice(0, f.n - f.d) });
  }

  const issues = [];
  const files = walk(join(root, "src"));
  // constantes de sélection connues (ex. PROFILE = `*, user_roles:…(role)`)
  const constants = new Map();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/const ([A-Z_]+) = [`"]([^`"$]*?(?:\$\{[A-Z_]+\}[^`"$]*?)*)[`"];/g)) constants.set(m[1], m[2]);
  }
  const expand = (s) => s.replace(/\$\{([A-Z_]+)\}/g, (_, k) => constants.get(k) ?? "*");

  function checkSelect(table, sel, where) {
    for (const raw of splitTop(sel.replace(/\s+/g, " "))) {
      let item = raw.trim();
      if (!item || item === "*") continue;
      const am = item.match(/^([A-Za-z0-9_]+):(?!:)(.*)$/s);
      if (am) item = am[2];
      const p = item.indexOf("(");
      if (p >= 0) {
        const rel = item.slice(0, p).split("!")[0];
        const inner = item.slice(p + 1, item.lastIndexOf(")"));
        if (tables.has(rel)) checkSelect(rel, inner, where);
        else if (!tables.get(table)?.has(rel)) issues.push(`${where} : relation « ${rel} » inconnue depuis ${table}`);
        continue;
      }
      const col = item.split("::")[0].trim();
      if (!/^[a-z_][a-z0-9_]*$/.test(col)) continue;
      if (!tables.get(table)?.has(col)) issues.push(`${where} : colonne ${table}.${col} inconnue`);
    }
  }

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = relative(root, file);
    const line = (i) => src.slice(0, i).split("\n").length;

    for (const m of src.matchAll(/\.from\(\s*"([a-z_0-9]+)"\s*\)/g)) {
      const before = src.slice(Math.max(0, m.index - 12), m.index);
      if (/storage\s*$/.test(before) || /\bstorage\b/.test(before)) continue; // Supabase Storage (buckets)
      const t = m[1];
      const where = `${rel}:${line(m.index)}`;
      if (!tables.has(t)) {
        issues.push(`${where} : table « ${t} » inconnue`);
        continue;
      }
      const end = chainEnd(src, m.index + m[0].length);
      const chain = src.slice(m.index + m[0].length, end);
      for (const s of chain.matchAll(/\.select\(\s*(["`])([^"`]*)\1/g)) checkSelect(t, expand(s[2]), where);
      for (const f of chain.matchAll(/\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|not|order|match)\(\s*"([a-z_0-9]+)"/g))
        if (!tables.get(t).has(f[2])) issues.push(`${where} : colonne ${t}.${f[2]} inconnue (.${f[1]})`);
      for (const oc of chain.matchAll(/onConflict:\s*"([^"]+)"/g))
        for (const c of oc[1].split(",")) if (!tables.get(t).has(c.trim())) issues.push(`${where} : onConflict ${t}.${c.trim()} inconnue`);
      for (const w of chain.matchAll(/\.(insert|update|upsert)\(\s*(\[\s*)?\{/g)) {
        const body = objectAt(chain, w.index + w[0].length - 1);
        if (body == null) continue;
        for (const k of topKeys(body)) if (!tables.get(t).has(k)) issues.push(`${where} : colonne ${t}.${k} inconnue (.${w[1]})`);
      }
    }

    for (const m of src.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"\s*(,\s*\{)?/g)) {
      const where = `${rel}:${line(m.index)}`;
      const cands = fns.get(m[1]);
      if (!cands) {
        issues.push(`${where} : fonction ${m[1]}() inconnue`);
        continue;
      }
      if (!m[2]) {
        if (!cands.some((c) => c.required.length === 0)) issues.push(`${where} : ${m[1]}() appelée sans ses arguments obligatoires`);
        continue;
      }
      const body = objectAt(src, m.index + m[0].length - 1);
      if (body == null) continue;
      const keys = topKeys(body);
      if (!cands.some((c) => keys.every((k) => c.inNames.includes(k)) && c.required.every((r) => keys.includes(r))))
        issues.push(`${where} : ${m[1]}(${keys.join(", ")}) ne correspond à aucune signature (${cands.map((c) => c.inNames.join(", ")).join(" | ")})`);
    }
  }
  return issues;
}
