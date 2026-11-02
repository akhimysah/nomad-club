// Couche de compatibilité « PostgREST + GoTrue » au-dessus de PGlite, pour les tests d'intégration
// du mode réel (scripts/test-mode-reel.mjs). Le vrai client supabase-js parle HTTP à Supabase ;
// ici, `fetch` est remplacé par une fonction qui traduit chaque requête REST en SQL, exécutée
// dans une transaction avec le rôle et l'identité de la personne (RLS appliquée comme sur Supabase).
//
// Couvert : select (colonnes, alias, ressources embarquées par clé étrangère, `!hint`, `!inner`),
// filtres eq/neq/gt/gte/lt/lte/like/ilike/is/in/cs/cd/ov + not. + or=(…), order, limit, offset,
// count=exact (+ HEAD), object+json (single / maybeSingle), insert / upsert (merge / ignore),
// update, delete, return=representation|minimal, rpc (arguments nommés, fonctions set-returning).
// Auth : /auth/v1/user, /otp (crée le compte avec ses métadonnées, comme Supabase), /logout,
// /admin/users (création, liste), /admin/generate_link. Les erreurs reprennent le format PostgREST.
//
// Ce n'est pas un PostgREST complet : une construction non gérée lève une erreur explicite
// (« postgrest-pglite : … non géré »), pour qu'un test ne passe jamais « par accident ».

const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function fakeJwt(claims) {
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.c2lnbmF0dXJl`;
}
export const ANON_KEY = fakeJwt({ role: "anon", iss: "supabase-test" });
export const SERVICE_KEY = fakeJwt({ role: "service_role", iss: "supabase-test" });

function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
const q = (id) => `"${String(id).replace(/"/g, '""')}"`;

class PgrstError extends Error {
  constructor(status, code, message, details = null, hint = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}
const unsupported = (what) => new PgrstError(500, "PGLITE", `postgrest-pglite : ${what} non géré`);

/* ---------------- introspection ---------------- */
async function introspect(db) {
  const cols = (
    await db.query(`
      select c.relname as t, c.relkind as k, a.attname as c, format_type(a.atttypid, a.atttypmod) as ty
        from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') and a.attnum > 0 and not a.attisdropped`)
  ).rows;
  const tables = new Map();
  for (const r of cols) {
    if (!tables.has(r.t)) tables.set(r.t, { kind: r.k, columns: new Map() });
    tables.get(r.t).columns.set(r.c, r.ty);
  }
  const fks = (
    await db.query(`
      select con.conname as name, cl.relname as tbl, fcl.relname as ftbl,
             (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n) as cols,
             (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n) as fcols
        from pg_constraint con
        join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
        join pg_class fcl on fcl.oid = con.confrelid join pg_namespace fn on fn.oid = fcl.relnamespace
       where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'`)
  ).rows;
  const pks = new Map(
    (
      await db.query(`
        select cl.relname as tbl, (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(n, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n) as cols
          from pg_constraint con join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
         where con.contype = 'p' and n.nspname = 'public'`)
    ).rows.map((r) => [r.tbl, r.cols]),
  );
  const fns = (
    await db.query(`
      select p.proname as name, coalesce(p.proargnames, '{}') as argnames, coalesce(p.proargmodes::text[], '{}') as argmodes,
             array(select format_type(t, null) from unnest(p.proargtypes) t) as argtypes,
             p.pronargs as nargs, p.pronargdefaults as ndefaults, p.proretset as retset, format_type(p.prorettype, null) as rettype
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'`)
  ).rows.map((f) => {
    // seuls les arguments d'entrée (in / inout / variadic) comptent pour l'appel
    const inNames = f.argmodes.length ? f.argnames.filter((_, i) => ["i", "b", "v"].includes(f.argmodes[i])) : f.argnames.slice(0, f.nargs);
    return { ...f, inNames, required: inNames.slice(0, f.nargs - f.ndefaults) };
  });
  return { tables, fks, pks, fns };
}

/* ---------------- analyse du paramètre select ---------------- */
function splitTop(s, sep = ",") {
  const out = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() !== "") out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseSelect(s) {
  return splitTop(s.replace(/\s+/g, (m, i, all) => (all.slice(0, i).split('"').length % 2 === 0 ? m : ""))).map((raw) => {
    let item = raw;
    if (item.startsWith("...")) throw unsupported(`spread « ${raw} »`);
    let alias = null;
    const m = item.match(/^([A-Za-z0-9_]+):(?!:)(.*)$/s);
    if (m) {
      alias = m[1];
      item = m[2];
    }
    const paren = item.indexOf("(");
    if (paren >= 0) {
      const head = item.slice(0, paren);
      const inner = item.slice(paren + 1, item.lastIndexOf(")"));
      const [rel, ...mods] = head.split("!");
      const isInner = mods.includes("inner");
      const hint = mods.find((x) => x !== "inner" && x !== "left") ?? null;
      if (rel === "count") throw unsupported("agrégat count()");
      return { type: "embed", rel, alias: alias ?? rel, hint, inner: isInner, children: parseSelect(inner || "*") };
    }
    if (item === "*") return { type: "star" };
    let cast = null;
    const c = item.match(/^(.*?)::([a-z0-9_ \[\]]+)$/i);
    if (c) {
      item = c[1];
      cast = c[2];
    }
    if (item.includes("->")) throw unsupported(`chemin JSON « ${raw} »`);
    return { type: "col", name: item, alias: alias ?? item, cast };
  });
}

/* ---------------- filtres ---------------- */
function parseList(v) {
  // (a,b,"c,d") → ["a","b","c,d"]
  const inner = v.replace(/^\(/, "").replace(/\)$/, "");
  if (inner === "") return [];
  return splitTop(inner).map((x) => (x.startsWith('"') && x.endsWith('"') ? x.slice(1, -1).replace(/\\"/g, '"') : x));
}
const unquote = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);

/* ---------------- moteur ---------------- */
export async function createPostgrest(db, opts = {}) {
  const meta = await introspect(db);
  const log = { otp: [], links: [], calls: [] };
  let aliasN = 0;

  const table = (name) => {
    const t = meta.tables.get(name);
    if (!t) throw new PgrstError(404, "PGRST205", `Could not find the table 'public.${name}' in the schema cache`);
    return t;
  };
  const colType = (tname, col) => {
    const ty = table(tname).columns.get(col);
    if (!ty) throw new PgrstError(400, "42703", `column ${tname}.${col} does not exist`);
    return ty;
  };

  function relationship(parent, rel, hint) {
    let cands = [];
    for (const fk of meta.fks) {
      if (fk.tbl === parent && fk.ftbl === rel) cands.push({ kind: "m2o", fk, target: rel });
      if (fk.ftbl === parent && fk.tbl === rel && !(fk.tbl === fk.ftbl && cands.some((c) => c.fk === fk))) cands.push({ kind: "o2m", fk, target: rel });
    }
    if (!cands.length) {
      // alias:colonne_fk(…) : relation désignée par la colonne de clé étrangère
      const viaCol = meta.fks.filter((fk) => fk.tbl === parent && fk.cols.length === 1 && fk.cols[0] === rel);
      cands = viaCol.map((fk) => ({ kind: "m2o", fk, target: fk.ftbl }));
    }
    if (hint) cands = cands.filter((c) => c.fk.name === hint || (c.fk.cols.length === 1 && c.fk.cols[0] === hint) || c.fk.ftbl === hint);
    if (!cands.length)
      throw new PgrstError(400, "PGRST200", `Could not find a relationship between '${parent}' and '${rel}' in the schema cache`, null, meta.tables.get(parent)?.kind === "v" ? "embedding depuis une vue : non géré par la couche de test" : null);
    if (cands.length > 1)
      throw new PgrstError(300, "PGRST201", `Could not embed because more than one relationship was found for '${parent}' and '${rel}'`, cands.map((c) => c.fk.name).join(", "));
    return cands[0];
  }

  /** Expressions de colonnes pour `items`, sur la table `tname` aliasée `a`. */
  function columns(tname, a, items, innerConds) {
    const out = [];
    for (const it of items) {
      if (it.type === "star") out.push(`${a}.*`);
      else if (it.type === "col") {
        colType(tname, it.name);
        out.push(`${a}.${q(it.name)}${it.cast ? `::${it.cast}` : ""} as ${q(it.alias)}`);
      } else {
        const r = relationship(tname, it.rel, it.hint);
        const c = `_e${++aliasN}`;
        const join =
          r.kind === "m2o"
            ? r.fk.cols.map((col, i) => `${c}.${q(r.fk.fcols[i])} = ${a}.${q(col)}`).join(" and ")
            : r.fk.cols.map((col, i) => `${c}.${q(col)} = ${a}.${q(r.fk.fcols[i])}`).join(" and ");
        const sub = columns(r.target, c, it.children, null).join(", ");
        const expr =
          r.kind === "m2o"
            ? `(select to_jsonb(${c}_r) from (select ${sub} from public.${q(r.target)} ${c} where ${join} limit 1) ${c}_r)`
            : `(select coalesce(jsonb_agg(to_jsonb(${c}_r)), '[]'::jsonb) from (select ${sub} from public.${q(r.target)} ${c} where ${join}) ${c}_r)`;
        out.push(`${expr} as ${q(it.alias)}`);
        if (it.inner) {
          if (!innerConds) throw unsupported("!inner imbriqué");
          innerConds.push(`exists (select 1 from public.${q(r.target)} ${c} where ${join})`);
        }
      }
    }
    return out;
  }

  function condition(tname, a, col, expr, params) {
    if (col.includes(".")) throw unsupported(`filtre sur une ressource embarquée « ${col} »`);
    const ty = colType(tname, col);
    const ref = `${a}.${q(col)}`;
    let neg = false;
    let e = expr;
    if (e.startsWith("not.")) {
      neg = true;
      e = e.slice(4);
    }
    const dot = e.indexOf(".");
    const op = e.slice(0, dot);
    const val = e.slice(dot + 1);
    const p = (v) => {
      params.push(v);
      return `$${params.length}`;
    };
    let sql;
    switch (op) {
      case "eq":
      case "neq":
      case "gt":
      case "gte":
      case "lt":
      case "lte": {
        const sym = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[op];
        sql = `${ref} ${sym} ${p(unquote(val))}::${ty}`;
        break;
      }
      case "like":
      case "ilike":
        sql = `${ref}::text ${op} ${p(unquote(val).replace(/\*/g, "%"))}`;
        break;
      case "is": {
        const v = val.toLowerCase();
        if (v === "null") sql = `${ref} is null`;
        else if (v === "not_null") sql = `${ref} is not null`;
        else if (v === "true" || v === "false" || v === "unknown") sql = `${ref} is ${v}`;
        else throw new PgrstError(400, "PGRST100", `is.${val} invalide`);
        break;
      }
      case "in": {
        const items = parseList(val);
        sql = items.length ? `${ref} in (${items.map((x) => `${p(x)}::${ty}`).join(", ")})` : "false";
        break;
      }
      case "cs":
      case "cd":
      case "ov":
        sql = `${ref} ${{ cs: "@>", cd: "<@", ov: "&&" }[op]} ${p(val)}::${ty}`;
        break;
      default:
        throw unsupported(`opérateur « ${op} »`);
    }
    return neg ? `not (${sql})` : sql;
  }

  function logic(tname, a, kind, body, params) {
    // body : "(a.eq.1,b.eq.2,and(c.eq.3,d.eq.4))"
    const parts = splitTop(body.replace(/^\(/, "").replace(/\)$/, "")).map((part) => {
      const m = part.match(/^(not\.)?(and|or)(\(.*\))$/s);
      if (m) return `${m[1] ? "not " : ""}(${logic(tname, a, m[2], m[3], params)})`;
      const d = part.indexOf(".");
      return condition(tname, a, part.slice(0, d), part.slice(d + 1), params);
    });
    return parts.length ? parts.join(kind === "or" ? " or " : " and ") : "true";
  }

  function where(tname, a, search, params) {
    const conds = [];
    for (const [k, v] of search) {
      if (RESERVED.has(k)) continue;
      if (k === "or" || k === "and") conds.push(`(${logic(tname, a, k, v, params)})`);
      else if (k === "not.or" || k === "not.and") conds.push(`not (${logic(tname, a, k.slice(4), v, params)})`);
      else conds.push(condition(tname, a, k, v, params));
    }
    return conds;
  }

  function orderBy(tname, a, order) {
    if (!order) return "";
    return (
      " order by " +
      splitTop(order)
        .map((part) => {
          const [col, ...mods] = part.split(".");
          if (col.includes("(")) throw unsupported("tri sur une ressource embarquée");
          colType(tname, col);
          let s = `${a}.${q(col)}`;
          if (mods.includes("desc")) s += " desc";
          if (mods.includes("nullsfirst")) s += " nulls first";
          if (mods.includes("nullslast")) s += " nulls last";
          return s;
        })
        .join(", ")
    );
  }

  async function withIdentity(headers, fn) {
    const bearer = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || headers.get("apikey") || "";
    const claims = decodeJwt(bearer) ?? { role: "anon" };
    const role = ["anon", "authenticated", "service_role"].includes(claims.role) ? claims.role : "anon";
    return db.transaction(async (tx) => {
      await tx.query(
        "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true), set_config('request.jwt.claims', $3, true)",
        [claims.sub ?? "", role, JSON.stringify(claims)],
      );
      await tx.exec(`set local role ${role}`);
      return fn(tx, claims);
    });
  }

  function respond(status, body, headers = {}) {
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  }

  function shape(rows, accept, method) {
    if (accept.includes("application/vnd.pgrst.object+json")) {
      if (rows.length !== 1)
        throw new PgrstError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `The result contains ${rows.length} rows`);
      return rows[0];
    }
    void method;
    return rows;
  }

  async function rest(url, method, headers, bodyText) {
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const prefer = headers.get("prefer") ?? "";
    const accept = headers.get("accept") ?? "";
    const wantCount = /count=(exact|planned|estimated)/.test(prefer);
    const body = bodyText ? JSON.parse(bodyText) : undefined;

    if (path.startsWith("rpc/")) return rpc(path.slice(4), method, headers, body, url, accept);

    const tname = path;
    table(tname);
    const a = "_t";
    const params = [];
    const items = parseSelect(url.searchParams.get("select") ?? "*");

    return withIdentity(headers, async (tx) => {
      log.calls.push(`${method} ${tname}`);
      if (method === "GET" || method === "HEAD") {
        const inner = [];
        const cols = columns(tname, a, items, inner);
        const conds = [...where(tname, a, url.searchParams, params), ...inner];
        const w = conds.length ? ` where ${conds.join(" and ")}` : "";
        const limit = url.searchParams.get("limit");
        const offset = url.searchParams.get("offset");
        const sql = `select coalesce(jsonb_agg(to_jsonb(_r)), '[]'::jsonb) as body from (select ${cols.join(", ")} from public.${q(tname)} ${a}${w}${orderBy(tname, a, url.searchParams.get("order"))}${limit ? ` limit ${Number(limit)}` : ""}${offset ? ` offset ${Number(offset)}` : ""}) _r`;
        const rows = (await tx.query(sql, params)).rows[0].body;
        let total = "*";
        if (wantCount) total = Number((await tx.query(`select count(*)::int as n from public.${q(tname)} ${a}${w}`, params)).rows[0].n);
        const range = `${rows.length ? `0-${rows.length - 1}` : "*"}/${total}`;
        if (method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": range } });
        return respond(200, shape(rows, accept, method), { "content-range": range });
      }

      const returning = prefer.includes("return=representation");
      const finish = async (mutation, affectedFallback) => {
        if (!returning) {
          const res = await tx.query(mutation, params);
          const n = res.affectedRows ?? affectedFallback ?? 0;
          return new Response(null, { status: method === "POST" ? 201 : 204, headers: { "content-range": `*/${wantCount ? n : "*"}` } });
        }
        const inner = [];
        const cols = columns(tname, a, items, inner);
        if (inner.length) throw unsupported("!inner sur une écriture");
        const sql = `with _m as (${mutation} returning ${a}.*) select coalesce(jsonb_agg(to_jsonb(_r)), '[]'::jsonb) as body from (select ${cols.join(", ")} from _m ${a}) _r`;
        const rows = (await tx.query(sql, params)).rows[0].body;
        return respond(method === "POST" ? 201 : 200, shape(rows, accept, method), { "content-range": `*/${rows.length}` });
      };

      if (method === "POST") {
        const rowsIn = Array.isArray(body) ? body : [body];
        const keys = url.searchParams.get("columns")?.split(",").map((s) => s.replace(/"/g, "")) ?? [...new Set(rowsIn.flatMap((r) => Object.keys(r)))];
        keys.forEach((k) => colType(tname, k));
        params.push(JSON.stringify(rowsIn));
        const list = keys.map(q).join(", ");
        let sql = `insert into public.${q(tname)} as ${a} (${list}) select ${list} from jsonb_populate_recordset(null::public.${q(tname)}, $1::jsonb)`;
        const merge = prefer.includes("resolution=merge-duplicates");
        const ignore = prefer.includes("resolution=ignore-duplicates");
        if (merge || ignore) {
          const target = url.searchParams.get("on_conflict")?.split(",").map((s) => s.trim()) ?? meta.pks.get(tname);
          if (!target) throw unsupported(`upsert sans clé sur ${tname}`);
          const upd = keys.filter((k) => !target.includes(k));
          sql += ` on conflict (${target.map(q).join(", ")}) do ${ignore || !upd.length ? "nothing" : `update set ${upd.map((k) => `${q(k)} = excluded.${q(k)}`).join(", ")}`}`;
        }
        return finish(sql, rowsIn.length);
      }
      if (method === "PATCH") {
        const keys = Object.keys(body ?? {});
        if (!keys.length) throw new PgrstError(400, "PGRST102", "Empty update");
        keys.forEach((k) => colType(tname, k));
        params.push(JSON.stringify(body));
        const conds = where(tname, a, url.searchParams, params);
        const list = keys.map(q).join(", ");
        const set = keys.length === 1 ? `${list} = (select ${list} from jsonb_populate_record(null::public.${q(tname)}, $1::jsonb))` : `(${list}) = (select ${list} from jsonb_populate_record(null::public.${q(tname)}, $1::jsonb))`;
        return finish(`update public.${q(tname)} as ${a} set ${set}${conds.length ? ` where ${conds.join(" and ")}` : ""}`);
      }
      if (method === "DELETE") {
        const conds = where(tname, a, url.searchParams, params);
        return finish(`delete from public.${q(tname)} as ${a}${conds.length ? ` where ${conds.join(" and ")}` : ""}`);
      }
      throw unsupported(`méthode ${method}`);
    });
  }

  async function rpc(name, method, headers, body, url, accept) {
    const args = method === "GET" ? Object.fromEntries(url.searchParams) : (body ?? {});
    const keys = Object.keys(args);
    const cands = meta.fns.filter((f) => f.name === name && keys.every((k) => f.inNames.includes(k)) && f.required.every((r) => keys.includes(r)));
    if (!cands.length)
      throw new PgrstError(404, "PGRST202", `Could not find the function public.${name}(${keys.join(", ")}) in the schema cache`, null, meta.fns.some((f) => f.name === name) ? `arguments attendus : ${meta.fns.filter((f) => f.name === name).map((f) => `(${f.inNames.join(", ")})`).join(" ou ")}` : null);
    if (cands.length > 1) throw new PgrstError(300, "PGRST203", `Could not choose the best candidate function between: ${name}`);
    const f = cands[0];
    const argSql = keys.map((k) => {
      const ty = f.argtypes[f.inNames.indexOf(k)];
      const src = `($1::jsonb -> ${`'${k.replace(/'/g, "''")}'`})`;
      if (ty === "json" || ty === "jsonb") return `${q(k)} => ${src}::${ty}`;
      if (ty.endsWith("[]")) return `${q(k)} => (case when jsonb_typeof(${src}) = 'array' then array(select jsonb_array_elements_text(${src})) end)::${ty}`;
      return `${q(k)} => (${src} #>> '{}')::${ty}`;
    });
    const call = `public.${q(name)}(${argSql.join(", ")})`;
    const params = keys.length ? [JSON.stringify(args)] : [];
    return withIdentity(headers, async (tx) => {
      log.calls.push(`rpc ${name}`);
      let out;
      if (f.retset) out = (await tx.query(`select coalesce(jsonb_agg(to_jsonb(_x)), '[]'::jsonb) as v from ${call} _x`, params)).rows[0].v;
      else if (f.rettype === "void") {
        await tx.query(`select ${call}`, params);
        out = null;
      } else out = (await tx.query(`select to_jsonb(${call}) as v`, params)).rows[0].v;
      if (Array.isArray(out) && accept.includes("application/vnd.pgrst.object+json")) out = shape(out, accept, method);
      if (headers.get("prefer")?.includes("count=")) return respond(200, out, { "content-range": `0-0/${Array.isArray(out) ? out.length : 1}` });
      return respond(200, out);
    });
  }

  /* ---------------- GoTrue (auth) ---------------- */
  async function userJson(id) {
    const r = (await db.query("select id, email, raw_user_meta_data, raw_app_meta_data, created_at, email_confirmed_at from auth.users where id = $1", [id])).rows[0];
    if (!r) return null;
    return {
      id: r.id,
      aud: "authenticated",
      role: "authenticated",
      email: r.email,
      email_confirmed_at: r.email_confirmed_at,
      user_metadata: r.raw_user_meta_data ?? {},
      app_metadata: r.raw_app_meta_data ?? {},
      created_at: r.created_at,
      factors: [],
    };
  }
  async function createUser(email, metadata = {}, confirmed = false) {
    const existing = (await db.query("select id from auth.users where lower(email) = lower($1)", [email])).rows[0];
    if (existing) return { id: existing.id, created: false };
    const id = (await db.query("select gen_random_uuid()::text as id")).rows[0].id;
    await db.query(
      "insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values ($1, 'authenticated', 'authenticated', $2, $3, '{}'::jsonb, $4::jsonb)",
      [id, email.toLowerCase(), confirmed ? new Date().toISOString() : null, JSON.stringify(metadata)],
    );
    return { id, created: true };
  }

  async function auth(url, method, headers, bodyText) {
    const path = url.pathname.replace(/^\/auth\/v1/, "");
    const body = bodyText ? JSON.parse(bodyText) : {};
    const bearer = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const claims = decodeJwt(bearer) ?? {};
    if (path === "/user" && method === "GET") {
      if (!claims.sub) return respond(401, { code: 401, error_code: "no_authorization", msg: "Invalid JWT" });
      const u = await userJson(claims.sub);
      return u ? respond(200, u) : respond(404, { code: 404, error_code: "user_not_found", msg: "User not found" });
    }
    if (path === "/logout") return new Response(null, { status: 204 });
    if (path === "/otp" && method === "POST") {
      log.otp.push({ email: body.email, data: body.data ?? {}, redirectTo: url.searchParams.get("redirect_to"), create: body.create_user });
      if (body.create_user !== false && body.email) await createUser(body.email, body.data ?? {});
      return respond(200, {});
    }
    if (path.startsWith("/admin/")) {
      if (claims.role !== "service_role") return respond(403, { code: 403, error_code: "not_admin", msg: "User not allowed" });
      if (path === "/admin/users" && method === "POST") {
        const { id, created } = await createUser(body.email, body.user_metadata ?? {}, !!body.email_confirm);
        if (!created) return respond(422, { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" });
        return respond(200, await userJson(id));
      }
      if (path === "/admin/users" && method === "GET") {
        const rows = (await db.query("select id from auth.users order by created_at")).rows;
        const users = [];
        for (const r of rows) users.push(await userJson(r.id));
        return respond(200, { users, aud: "authenticated" }, { "x-total-count": String(users.length) });
      }
      const del = path.match(/^\/admin\/users\/([0-9a-f-]{36})$/);
      if (del && method === "DELETE") {
        // suppression « douce » (should_soft_delete) : la ligne reste, l'e-mail est libéré
        if (body.should_soft_delete) await db.query("update auth.users set email = null, raw_user_meta_data = '{}'::jsonb where id = $1", [del[1]]);
        else await db.query("delete from auth.users where id = $1", [del[1]]);
        return respond(200, {});
      }
      if (path === "/admin/generate_link" && method === "POST") {
        const { id } = await createUser(body.email, body.data ?? {}, true);
        const link = `${opts.siteUrl ?? "http://localhost:3000"}/auth/callback?code=test-${id}`;
        log.links.push({ email: body.email, type: body.type, link });
        return respond(200, { ...(await userJson(id)), action_link: link, properties: { action_link: link, email_otp: "000000", hashed_token: "x", redirect_to: body.redirect_to ?? null, verification_type: body.type } });
      }
    }
    throw unsupported(`auth ${method} ${path}`);
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    const headers = new Headers(init.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined));
    const bodyText = typeof init.body === "string" ? init.body : init.body == null ? null : await new Response(init.body).text();
    try {
      if (url.pathname.startsWith("/auth/v1/")) return await auth(url, method, headers, bodyText);
      if (url.pathname.startsWith("/rest/v1/")) return await rest(url, method, headers, bodyText);
      throw unsupported(`adresse ${url.pathname}`);
    } catch (e) {
      if (e instanceof PgrstError) {
        if (e.code === "PGLITE" && opts.strict !== false) opts.onUnsupported?.(e.message);
        return respond(e.status, { code: e.code, message: e.message, details: e.details, hint: e.hint });
      }
      const code = e.code ?? "XX000";
      const status = code === "42501" ? 403 : code === "23505" || code === "23503" ? 409 : code === "P0002" ? 404 : 400;
      return respond(status, { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
    }
  }

  return { fetch: fetchImpl, meta, log, createUser };
}
