// Serveur du carnet en ligne : comptes membres validés par les fondatrices.
// Aucune dépendance : Node 22+ (node:sqlite, node:crypto, node:http).
//
// Variables d'environnement :
//   PORT            port d'écoute (défaut 3010)
//   SITE_DIR        dossier du site statique (défaut ../carnet-site)
//   DB_PATH         fichier SQLite (défaut ./carnet.db)
//   SESSION_SECRET  clé secrète des sessions (obligatoire en production)
//
// Donner l'accès admin à une fondatrice déjà inscrite (sur le serveur) :
//   node server.mjs admin email@exemple.com
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3010);
const SITE_DIR = resolve(process.env.SITE_DIR || join(here, "../carnet-site"));
const DB_PATH = process.env.DB_PATH || join(here, "carnet.db");
const SECRET = process.env.SESSION_SECRET || "dev-secret-a-changer";
const SESSION_DAYS = 60;
const PUBLIC_FILES = new Set(["/img/logotype-clair.png", "/img/monogramme-clair.png", "/icon.png", "/apple-icon.png"]);

/* ---------------- base ---------------- */
const db = new DatabaseSync(DB_PATH);
db.exec(`
  pragma journal_mode = wal;
  create table if not exists users (
    id integer primary key,
    first_name text not null,
    last_name text not null,
    email text not null unique collate nocase,
    whatsapp text not null default '',
    pass_hash text not null,
    role text not null default 'member' check (role in ('member', 'founder')),
    status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
    created_at text not null default (datetime('now')),
    decided_at text,
    reset_token text,
    reset_expires integer
  );
`);
const q = {
  byEmail: db.prepare("select * from users where email = ?"),
  byId: db.prepare("select * from users where id = ?"),
  byReset: db.prepare("select * from users where reset_token = ? and reset_expires > ?"),
  insert: db.prepare("insert into users (first_name, last_name, email, whatsapp, pass_hash, role, status, decided_at) values (?, ?, ?, ?, ?, ?, ?, ?)"),
  all: db.prepare("select * from users order by created_at desc"),
  pendingCount: db.prepare("select count(*) as n from users where status = 'pending'"),
  setStatus: db.prepare("update users set status = ?, decided_at = datetime('now') where id = ?"),
  setRole: db.prepare("update users set role = ? where id = ?"),
  setReset: db.prepare("update users set reset_token = ?, reset_expires = ? where id = ?"),
  setPass: db.prepare("update users set pass_hash = ?, reset_token = null, reset_expires = null where id = ?"),
};

/* ---------------- mots de passe et sessions ---------------- */
const hashPass = (pw) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
};
const checkPass = (pw, stored) => {
  const [salt, hex] = stored.split(":");
  const a = Buffer.from(hex, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
};
const sign = (s) => createHmac("sha256", SECRET).update(s).digest("base64url");
// Le jeton dépend du mot de passe : en changer déconnecte les anciennes sessions.
const sessionToken = (u, exp) => `${u.id}.${exp}.${sign(`${u.id}.${exp}.${u.pass_hash}`)}`;
function currentUser(req) {
  const m = /(?:^|;\s*)nc_s=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  const [id, exp, sig] = m[1].split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  const u = q.byId.get(Number(id));
  if (!u) return null;
  const good = sign(`${u.id}.${exp}.${u.pass_hash}`);
  if (good.length !== sig.length || !timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  return u;
}
const secure = (req) => req.headers["x-forwarded-proto"] === "https";
const sessionCookie = (req, u) => {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return `nc_s=${sessionToken(u, exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure(req) ? "; Secure" : ""}`;
};
const clearCookie = "nc_s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

/* ---------------- limite de tentatives ---------------- */
const hits = new Map();
function tooMany(req, key, max = 10) {
  const ip = req.headers["x-real-ip"] || req.socket.remoteAddress;
  const k = `${key}:${ip}`;
  const now = Date.now();
  const list = (hits.get(k) || []).filter((t) => now - t < 10 * 60e3);
  list.push(now);
  hits.set(k, list);
  return list.length > max;
}

/* ---------------- HTML ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const CSS = `
:root{--bg:#0b0b0b;--s1:#111;--line:rgba(226,226,226,.13);--line2:rgba(226,226,226,.26);--tx:#f3f3f3;--tx2:#dedede;--muted:#c3c3c3;--accent:#d3d3d3;--fill:rgba(243,243,243,.06);--gold:linear-gradient(135deg,#ededed 0%,#d5d5d5 36%,#b6b6b6 68%,#e2e2e2 100%);--ink:#111;--serif:"Playfair Display",Didot,Georgia,serif;--sans:"Albert Sans","Helvetica Neue",Arial,system-ui,sans-serif;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.55 var(--sans);-webkit-font-smoothing:antialiased;min-height:100vh}
a{color:var(--tx)}
.wrap{max-width:440px;margin:0 auto;padding:48px 16px 64px}
.wide{max-width:980px}
.logo{display:block;height:44px;margin:0 auto 28px}
h1{font:500 34px/1.1 var(--serif);margin:0 0 8px;text-align:center}
.lead{color:var(--tx2);text-align:center;margin:0 0 28px}
.box{background:var(--s1);border-radius:26px;box-shadow:inset 0 0 0 1px var(--line);padding:24px}
label{display:block;font:600 14px var(--sans);color:var(--tx2);margin:0 0 7px}
input{width:100%;height:52px;border-radius:16px;border:1px solid var(--line2);background:var(--fill);color:var(--tx);font:500 16px var(--sans);padding:0 16px;outline:none;margin-bottom:16px}
input:focus{border-color:var(--accent)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
button,.btn{appearance:none;border:0;cursor:pointer;height:52px;width:100%;border-radius:999px;background:var(--gold);color:var(--ink);font:600 16px var(--sans);text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.small{height:36px;width:auto;padding:0 14px;font-size:13.5px}
.ghost{background:var(--fill);color:var(--tx);box-shadow:inset 0 0 0 1px var(--line2)}
.alt{text-align:center;color:var(--muted);margin-top:20px;font-size:15px}
.msg{padding:12px 14px;border-radius:14px;background:var(--fill);color:var(--tx2);margin-bottom:18px;font-size:15px}
.msg.err{box-shadow:inset 0 0 0 1px rgba(255,140,140,.45)}
h2{font:500 24px var(--serif);margin:32px 0 12px}
table{width:100%;border-collapse:collapse;font-size:14.5px}
td,th{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12.5px;text-transform:uppercase;letter-spacing:.06em}
td .acts{display:flex;gap:6px;flex-wrap:wrap}
.top{display:flex;align-items:center;gap:14px;margin-bottom:8px}.top img{height:34px}.top a{margin-left:auto}
.link{word-break:break-all;font-size:14px}
.empty{color:var(--muted)}
@media(max-width:700px){table,tbody,tr,td{display:block}thead{display:none}tr{border-bottom:1px solid var(--line);padding:10px 0}td{border:0;padding:3px 0}}
`;
const page = (title, body, wide = false) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Nomad Club</title><link rel="icon" href="/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><main class="wrap${wide ? " wide" : ""}">${body}</main></body></html>`;
const msg = (text, err = false) => (text ? `<div class="msg${err ? " err" : ""}">${esc(text)}</div>` : "");
const logo = `<img class="logo" src="/img/logotype-clair.png" alt="Nomad Club">`;

const loginPage = (note = "", err = false, email = "") =>
  page("Connexion", `${logo}<h1>Le carnet du club</h1><p class="lead">Réservé aux membres du Nomad Club.</p>
<form class="box" method="post" action="/connexion">${msg(note, err)}
<label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required value="${esc(email)}">
<label for="password">Mot de passe</label><input id="password" name="password" type="password" autocomplete="current-password" required>
<button>Se connecter</button></form>
<p class="alt">Pas encore de compte ? <a href="/inscription">Demander un accès</a></p>`);

const signupPage = (note = "", v = {}) =>
  page("Demander un accès", `${logo}<h1>Demander un accès</h1><p class="lead">Julia ou Nora valident chaque inscription. Tu reçois l’accès dès que c’est fait.</p>
<form class="box" method="post" action="/inscription">${msg(note, true)}
<div class="row"><div><label for="first">Prénom</label><input id="first" name="first_name" autocomplete="given-name" required value="${esc(v.first_name)}"></div>
<div><label for="last">Nom</label><input id="last" name="last_name" autocomplete="family-name" required value="${esc(v.last_name)}"></div></div>
<label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required value="${esc(v.email)}">
<label for="wa">WhatsApp</label><input id="wa" name="whatsapp" type="tel" autocomplete="tel" placeholder="+212 6…" value="${esc(v.whatsapp)}">
<label for="pw">Mot de passe (8 caractères minimum)</label><input id="pw" name="password" type="password" autocomplete="new-password" minlength="8" required>
<button>Envoyer ma demande</button></form>
<p class="alt">Déjà un compte ? <a href="/connexion">Se connecter</a></p>`);

const donePage = (title, text) => page(title, `${logo}<h1>${esc(title)}</h1><p class="lead">${esc(text)}</p><p class="alt"><a href="/connexion">Retour à la connexion</a></p>`);

function adminPage(me, note = "", link = "") {
  const users = q.all.all();
  const when = (s) => (s ? new Date(s.replace(" ", "T") + "Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "");
  const act = (u, action, label, cls = "small") => `<form method="post" action="/admin"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="action" value="${action}"><button class="${cls}">${label}</button></form>`;
  const row = (u, acts) => `<tr><td><b>${esc(u.first_name)} ${esc(u.last_name)}</b>${u.role === "founder" ? " · fondatrice" : ""}</td><td>${esc(u.email)}<br>${esc(u.whatsapp)}</td><td>${when(u.created_at)}</td><td><div class="acts">${acts}</div></td></tr>`;
  const table = (list, acts) =>
    list.length ? `<table><thead><tr><th>Nom</th><th>Contact</th><th>Inscrite le</th><th></th></tr></thead><tbody>${list.map((u) => row(u, acts(u))).join("")}</tbody></table>` : `<p class="empty">Personne pour l’instant.</p>`;
  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");
  const refused = users.filter((u) => u.status === "refused");
  return page(
    "Admin",
    `<div class="top"><img src="/img/logotype-clair.png" alt="Nomad Club"><a class="btn small ghost" href="/">Voir le carnet</a></div>
<h1 style="text-align:left">Accès au carnet</h1>${msg(note)}${link ? `<div class="msg">Envoie ce lien à la membre (valable 7 jours) :<br><span class="link">${esc(link)}</span></div>` : ""}
<h2>En attente (${pending.length})</h2>${table(pending, (u) => act(u, "approve", "Accepter") + act(u, "refuse", "Refuser", "small ghost"))}
<h2>Membres (${approved.length})</h2>${table(approved, (u) =>
      u.id === me.id
        ? `<span class="empty">C’est toi</span>`
        : act(u, "reset", "Lien mot de passe", "small ghost") + (u.role === "founder" ? act(u, "demote", "Retirer admin", "small ghost") : act(u, "promote", "Rendre admin", "small ghost")) + act(u, "revoke", "Retirer l’accès", "small ghost"),
    )}
<h2>Refusées (${refused.length})</h2>${table(refused, (u) => act(u, "approve", "Accepter", "small ghost"))}`,
    true,
  );
}

/* ---------------- utilitaires HTTP ---------------- */
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "referrer-policy": "same-origin", ...headers });
  res.end(body);
};
const redirect = (res, to, headers = {}) => send(res, 303, "", { location: to, ...headers });
const readForm = (req) =>
  new Promise((ok, ko) => {
    let s = "";
    req.on("data", (c) => {
      s += c;
      if (s.length > 20_000) {
        ko(new Error("trop long"));
        req.destroy();
      }
    });
    req.on("end", () => ok(Object.fromEntries(new URLSearchParams(s))));
    req.on("error", ko);
  });
const sameOrigin = (req) => {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    return new URL(o).host === (req.headers["x-forwarded-host"] || req.headers.host);
  } catch {
    return false;
  }
};
const TYPES = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
function sendFile(res, rel) {
  const file = normalize(join(SITE_DIR, rel));
  if (!file.startsWith(SITE_DIR + sep)) return send(res, 404, "Introuvable");
  try {
    if (!statSync(file).isFile()) throw new Error();
  } catch {
    return send(res, 404, "Introuvable");
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "private, max-age=86400" });
  res.end(readFileSync(file));
}
function carnetHtml(u) {
  const pending = u.role === "founder" ? q.pendingCount.get().n : 0;
  const nav = `<nav class="nav">${u.role === "founder" ? `<a href="/admin">Admin${pending ? ` (${pending})` : ""}</a>` : ""}<form method="post" action="/deconnexion"><button>Se déconnecter</button></form></nav>`;
  return readFileSync(join(SITE_DIR, "index.html"), "utf8").replace("<!--NAV-->", nav);
}

/* ---------------- routes ---------------- */
async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  const user = currentUser(req);
  const ok = user && user.status === "approved";

  if (req.method === "POST" && !sameOrigin(req)) return send(res, 403, "Requête refusée");

  if (path === "/connexion") {
    if (req.method === "GET") return ok ? redirect(res, "/") : send(res, 200, loginPage());
    if (tooMany(req, "login")) return send(res, 429, loginPage("Trop d’essais. Réessaie dans quelques minutes.", true));
    const f = await readForm(req);
    const u = q.byEmail.get(String(f.email || "").trim());
    if (!u || !checkPass(String(f.password || ""), u.pass_hash)) return send(res, 200, loginPage("E-mail ou mot de passe incorrect.", true, f.email));
    if (u.status === "pending") return send(res, 200, loginPage("Ta demande est bien reçue : elle attend la validation de Julia ou Nora.", false, f.email));
    if (u.status === "refused") return send(res, 200, loginPage("Ce compte n’a pas accès au carnet. Écris aux fondatrices si c’est une erreur.", true, f.email));
    return redirect(res, "/", { "set-cookie": sessionCookie(req, u) });
  }

  if (path === "/inscription") {
    if (req.method === "GET") return ok ? redirect(res, "/") : send(res, 200, signupPage());
    if (tooMany(req, "signup", 6)) return send(res, 429, signupPage("Trop de demandes. Réessaie plus tard."));
    const f = await readForm(req);
    const v = {
      first_name: String(f.first_name || "").trim().slice(0, 60),
      last_name: String(f.last_name || "").trim().slice(0, 60),
      email: String(f.email || "").trim().toLowerCase().slice(0, 120),
      whatsapp: String(f.whatsapp || "").trim().slice(0, 30),
    };
    const pw = String(f.password || "");
    if (!v.first_name || !v.last_name) return send(res, 200, signupPage("Indique ton prénom et ton nom.", v));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return send(res, 200, signupPage("Cet e-mail ne semble pas valide.", v));
    if (pw.length < 8) return send(res, 200, signupPage("Le mot de passe doit faire au moins 8 caractères.", v));
    if (q.byEmail.get(v.email)) return send(res, 200, signupPage("Un compte existe déjà avec cet e-mail. Connecte-toi.", v));
    q.insert.run(v.first_name, v.last_name, v.email, v.whatsapp, hashPass(pw), "member", "pending", null);
    return send(res, 200, donePage("Demande envoyée", `Merci ${v.first_name} ! Julia ou Nora vont valider ton accès. Tu pourras ensuite te connecter avec ton e-mail et ton mot de passe.`));
  }

  if (path === "/nouveau-mot-de-passe") {
    const t = String(url.searchParams.get("t") || "");
    const u = t ? q.byReset.get(t, Date.now()) : null;
    if (!u) return send(res, 200, donePage("Lien expiré", "Ce lien n’est plus valable. Demande-en un nouveau aux fondatrices."));
    const form = (note = "") =>
      page("Nouveau mot de passe", `${logo}<h1>Nouveau mot de passe</h1><p class="lead">Pour ${esc(u.first_name)} ${esc(u.last_name)}</p>
<form class="box" method="post">${msg(note, true)}<label for="pw">Mot de passe (8 caractères minimum)</label><input id="pw" name="password" type="password" autocomplete="new-password" minlength="8" required><button>Enregistrer</button></form>`);
    if (req.method === "GET") return send(res, 200, form());
    const f = await readForm(req);
    const pw = String(f.password || "");
    if (pw.length < 8) return send(res, 200, form("Le mot de passe doit faire au moins 8 caractères."));
    q.setPass.run(hashPass(pw), u.id);
    return redirect(res, "/connexion");
  }

  if (path === "/deconnexion") return redirect(res, "/connexion", { "set-cookie": clearCookie });

  if (path === "/admin") {
    if (!ok) return redirect(res, "/connexion");
    if (user.role !== "founder") return redirect(res, "/");
    if (req.method === "GET") return send(res, 200, adminPage(user));
    const f = await readForm(req);
    const target = q.byId.get(Number(f.id));
    if (!target || target.id === user.id) return send(res, 200, adminPage(user, "Action impossible."));
    const name = `${target.first_name} ${target.last_name}`;
    switch (f.action) {
      case "approve":
        q.setStatus.run("approved", target.id);
        return send(res, 200, adminPage(user, `${name} a maintenant accès au carnet.`));
      case "refuse":
      case "revoke":
        q.setStatus.run("refused", target.id);
        return send(res, 200, adminPage(user, `${name} n’a plus accès au carnet.`));
      case "promote":
        q.setRole.run("founder", target.id);
        return send(res, 200, adminPage(user, `${name} peut maintenant gérer les accès.`));
      case "demote":
        q.setRole.run("member", target.id);
        return send(res, 200, adminPage(user, `${name} ne gère plus les accès.`));
      case "reset": {
        const token = randomBytes(24).toString("base64url");
        q.setReset.run(token, Date.now() + 7 * 864e5, target.id);
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        return send(res, 200, adminPage(user, `Lien de nouveau mot de passe créé pour ${name}.`, `${secure(req) ? "https" : "http"}://${host}/nouveau-mot-de-passe?t=${token}`));
      }
      default:
        return send(res, 200, adminPage(user, "Action inconnue."));
    }
  }

  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Méthode non permise");
  if (PUBLIC_FILES.has(path)) return sendFile(res, path);
  if (!ok) return redirect(res, "/connexion");
  if (path === "/" || path === "/index.html") return send(res, 200, carnetHtml(user));
  return sendFile(res, path);
}

if (process.argv[2] === "admin") {
  const u = q.byEmail.get(String(process.argv[3] || ""));
  if (!u) {
    console.error("Aucun compte avec cet e-mail : il faut d'abord s'inscrire sur le site.");
    process.exit(1);
  }
  q.setRole.run("founder", u.id);
  q.setStatus.run("approved", u.id);
  console.log(`${u.first_name} ${u.last_name} est maintenant admin du carnet.`);
  process.exit(0);
}

createServer((req, res) =>
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) send(res, 500, "Erreur du serveur");
  }),
).listen(PORT, "127.0.0.1", () => console.log(`Carnet : http://127.0.0.1:${PORT} (site : ${SITE_DIR})`));
