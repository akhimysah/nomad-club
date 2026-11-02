// Lecture minimale des fichiers .env (sans dépendance) : KEY=valeur, commentaires #, guillemets facultatifs.
// Les variables déjà présentes dans l'environnement gardent la priorité.
import { existsSync, readFileSync } from "node:fs";

export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v;
  }
  return out;
}

/** Fusionne les fichiers (le premier trouvé gagne pour une même clé) sous l'environnement réel. */
export function loadEnvFiles(files) {
  const merged = {};
  const used = [];
  for (const f of files) {
    if (!existsSync(f)) continue;
    used.push(f);
    const vars = parseEnv(readFileSync(f, "utf8"));
    for (const [k, v] of Object.entries(vars)) if (!(k in merged)) merged[k] = v;
  }
  return { vars: merged, used };
}
