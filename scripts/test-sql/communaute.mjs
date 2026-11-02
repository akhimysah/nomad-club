// Lot 1 — Communauté : vérifications de 0004_communaute.sql (RLS, fonctions, déclencheurs).
// Appelé par scripts/test-sql.mjs avec les outils du banc (db, as, rejects, ok…).

/**
 * @param {{ db: import("@electric-sql/pglite").PGlite, as: Function, rejects: Function, one: Function, count: Function, ok: (c: boolean, l: string) => void, uuid: (id: string) => string }} t
 */
export async function testCommunaute({ db, as, rejects, one, count, ok, uuid }) {
  const JULIA = uuid("p-julia");
  const INES = uuid("p-ines");
  const YASMINE = uuid("p-yasmine");
  const SALMA = uuid("p-salma");
  const NADIA = uuid("p-nadia");
  const AURELIE = uuid("p-aurelie");
  const LOU = uuid("p-lou");
  const RIM = uuid("p-rim");
  const G01 = uuid("p-g01");
  const G02 = uuid("p-g02");
  const INVEST = uuid("grp-invest");
  const FOND = uuid("grp-fondatrices");
  const LECTURE = uuid("grp-lecture");
  const TECH = uuid("grp-tech");
  const MSG_H2 = uuid("msg-h2");
  const MSG_2 = uuid("msg-2");
  const ch = (g) => `group:${g}`;
  /** Change de personne dans la même transaction (rôle authenticated conservé). */
  const switchTo = (tx, id) => tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);

  console.log("\nLot 1 · Groupes thématiques");
  const inesGroups = await as(INES, (tx) => count(tx, "select count(*) from public.chat_groups"));
  ok(inesGroups === 5, `Inès voit les 5 groupes listés (${inesGroups})`);
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.chat_groups where id = $1", [FOND])) === 0, "…mais pas le groupe privé dont elle n'est pas membre");
  ok(await as(NADIA, (tx) => count(tx, "select count(*) from public.chat_groups where id = $1", [FOND])) === 1, "Nadia, membre du groupe privé, le voit");
  ok(await as(RIM, (tx) => count(tx, "select count(*) from public.chat_groups")) === 0, "Rim (partenaire, hors cercle) ne voit aucun groupe");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.messages where channel = $1", [ch(INVEST)])) === 0, "Inès (demande en attente) ne lit pas les messages d'« Investisseuses »");
  ok(await as(JULIA, (tx) => count(tx, "select count(*) from public.messages where channel = $1", [ch(INVEST)])) > 0, "Julia, membre du groupe, les lit");
  ok(await as(YASMINE, (tx) => count(tx, "select count(*) from public.messages where channel = $1", [ch(FOND)])) > 0, "Yasmine (modératrice) lit les groupes pour les modérer");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.chat_group_members where group_id = $1", [INVEST])) === 1, "Inès ne voit que sa propre demande dans « Investisseuses »");
  ok(await rejects(INES, "insert into public.messages (channel, author_id, body) values ($1, $2, 'Bonjour')", [ch(INVEST), INES]), "Inès n'écrit pas dans un groupe dont elle n'est pas membre");
  ok(await as(INES, async (tx) => {
    await tx.query("insert into public.messages (channel, author_id, body) values ($1, $2, 'Je viens jeudi !')", [ch(LECTURE), INES]);
    return count(tx, "select count(*) from public.messages where channel = $1 and author_id = $2", [ch(LECTURE), INES]);
  }) >= 1, "…mais écrit dans le club de lecture, dont elle est membre");
  ok(await as(SALMA, async (tx) => (await one(tx, "select public.join_group($1) as s", [TECH])).s) === "member", "groupe ouvert : Salma devient membre tout de suite");
  ok(await as(SALMA, async (tx) => {
    const s = (await one(tx, "select public.join_group($1) as s", [INVEST])).s;
    await tx.exec("reset role");
    const n = await count(tx, "select count(*) from public.notifications where type = 'group_request' and recipient_id in ($1, $2)", [JULIA, YASMINE]);
    return s === "pending" && n >= 2;
  }), "groupe sur demande : demande en attente, modératrice et administratrices prévenues");
  ok(await rejects(SALMA, "insert into public.chat_group_members (group_id, profile_id, status) values ($1, $2, 'member')", [INVEST, SALMA]), "Salma ne s'ajoute pas elle-même comme membre d'un groupe sur demande");
  ok(await rejects(SALMA, "select public.join_group($1)", [FOND]), "personne ne rejoint seule un groupe privé");
  ok(await rejects(INES, "select public.decide_group_request($1, $2, true)", [INVEST, INES]), "Inès ne valide pas sa propre demande");
  ok(await as(YASMINE, async (tx) => {
    const done = (await one(tx, "select public.decide_group_request($1, $2, true) as v", [INVEST, INES])).v;
    await switchTo(tx, INES);
    const n = await count(tx, "select count(*) from public.messages where channel = $1", [ch(INVEST)]);
    const notif = await count(tx, "select count(*) from public.notifications where type = 'group_joined'");
    return done && n > 0 && notif === 1;
  }), "Yasmine accepte Inès : elle lit le groupe et reçoit une notification");
  ok(await as(INES, async (tx) => {
    await tx.query("delete from public.chat_group_members where group_id = $1 and profile_id = $2", [LECTURE, INES]);
    return count(tx, "select count(*) from public.chat_group_members where group_id = $1 and profile_id = $2", [LECTURE, INES]);
  }) === 0, "Inès quitte un groupe");
  ok(await rejects(INES, "insert into public.chat_groups (slug, name) values ('mon-groupe', 'Mon groupe')"), "une membre ne crée pas de groupe");
  ok(await as(YASMINE, async (tx) => {
    await tx.query("insert into public.chat_groups (slug, name, join_policy) values ('jardinage', 'Jardinage', 'request')");
    return count(tx, "select count(*) from public.chat_groups where slug = 'jardinage'");
  }) === 1, "une modératrice crée un groupe");

  console.log("\nLot 1 · Modération");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.message_reports")) === 0, "Inès (non modératrice) ne voit pas la file de modération");
  ok(await as(SALMA, (tx) => count(tx, "select count(*) from public.message_reports")) === 1, "Salma ne voit que son propre signalement");
  ok(await as(YASMINE, (tx) => count(tx, "select count(*) from public.message_reports where status = 'open'")) === 3, "Yasmine (modératrice) voit les 3 signalements ouverts");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.moderation_keywords")) === 0, "Inès ne voit pas la liste des mots-clés");
  ok(await rejects(INES, "insert into public.moderation_keywords (keyword, action) values ('test', 'hide')"), "…et n'en ajoute pas");
  ok(await as(YASMINE, async (tx) => {
    await tx.query("insert into public.moderation_keywords (keyword, action, created_by) values ('spam', 'hide', $1)", [YASMINE]);
    return count(tx, "select count(*) from public.moderation_keywords");
  }) === 7, "Yasmine ajoute un mot-clé");
  ok(await rejects(YASMINE, "insert into public.moderation_keywords (keyword, action) values ('ARNAQUÉ', 'flag')"), "un mot-clé existe une seule fois (majuscules et accents confondus)");
  ok(await as(INES, async (tx) => {
    const m = await one(tx, "insert into public.messages (channel, author_id, body) values ('general', $1, 'Attention, grosse ARNAQUE au loyer à Guéliz') returning id", [INES]);
    const row = await one(tx, "select body, hidden_at from public.messages where id = $1", [m.id]);
    const originals = await count(tx, "select count(*) from public.message_originals where message_id = $1", [m.id]);
    await switchTo(tx, YASMINE);
    const orig = await one(tx, "select body from public.message_originals where message_id = $1", [m.id]);
    const rep = await one(tx, "select source, keyword from public.message_reports where message_id = $1", [m.id]);
    const notif = await count(tx, "select count(*) from public.notifications where type = 'moderation_report' and body like '%ARNAQUE%'");
    return row.hidden_at && row.body === "[masqué]" && originals === 0 && orig?.body.includes("ARNAQUE") && rep?.source === "keyword" && notif === 1;
  }), "mot-clé « masquer » : message masqué, original réservé à la modération, signalement et notification");
  ok(await as(INES, async (tx) => {
    const m = await one(tx, "insert into public.messages (channel, author_id, body) values ('general', $1, 'Vous placez votre trésorerie en crypto ?') returning id", [INES]);
    const row = await one(tx, "select hidden_at from public.messages where id = $1", [m.id]);
    await tx.exec("reset role");
    const rep = await one(tx, "select source, keyword from public.message_reports where message_id = $1", [m.id]);
    return !row.hidden_at && rep?.keyword === "crypto";
  }), "mot-clé « signaler » : message visible mais signalé");
  ok(await as(INES, async (tx) => {
    const m = await one(tx, "insert into public.messages (channel, author_id, body) values ($1, $2, 'C’est une pyramide, fuis !') returning id", [`dm:${[INES, JULIA].sort().join(":")}`, INES]);
    return !!(await one(tx, "select hidden_at from public.messages where id = $1", [m.id])).hidden_at;
  }), "la modération par mots-clés s'applique aussi aux messages privés");
  ok(await as(INES, async (tx) => {
    const id = (await one(tx, "select public.report_message($1, 'Publicité') as id", [MSG_H2])).id;
    const again = (await one(tx, "select public.report_message($1, 'Encore') as id", [MSG_H2])).id;
    return !!id && id === again && (await count(tx, "select count(*) from public.message_reports")) === 1;
  }), "Inès signale un message du salon (une seule fois) et retrouve son signalement");
  const investMsg = (await one(db, "select id from public.messages where channel = $1 limit 1", [ch(INVEST)])).id;
  ok(await rejects(SALMA, "select public.report_message($1, 'x')", [investMsg]), "on ne signale pas un message qu'on ne peut pas lire");
  ok(await as(INES, async (tx) => {
    const m = await one(tx, "insert into public.messages (channel, author_id, body) values ('general', $1, 'Bonjour à toutes') returning id", [INES]);
    try {
      await tx.query("savepoint s");
      await tx.query("select public.report_message($1, 'x')", [m.id]);
      return false;
    } catch {
      await tx.query("rollback to savepoint s");
      return true;
    }
  }), "on ne signale pas son propre message");
  ok(await rejects(INES, "select public.moderate_message($1, 'hide', 'x')", [MSG_2]), "Inès ne masque pas de message");
  ok(await as(INES, async (tx) => {
    await tx.query("update public.messages set body = 'modifié' where id = $1", [MSG_2]);
    return (await one(tx, "select body from public.messages where id = $1", [MSG_2])).body !== "modifié";
  }), "…ni ne modifie celui d'une autre");
  ok(await as(YASMINE, async (tx) => {
    await tx.query("select public.moderate_message($1, 'hide', 'Hors charte')", [MSG_2]);
    const hidden = await one(tx, "select body, hidden_at from public.messages where id = $1", [MSG_2]);
    await tx.query("select public.moderate_message($1, 'restore')", [MSG_2]);
    const back = await one(tx, "select body, hidden_at from public.messages where id = $1", [MSG_2]);
    return hidden.body === "[masqué]" && !!hidden.hidden_at && back.body.includes("Kahneman") && !back.hidden_at;
  }), "Yasmine masque puis rétablit un message (le texte d'origine revient)");
  ok(await as(YASMINE, async (tx) => {
    const rep = await one(tx, "select id, message_author_id from public.message_reports where message_id = $1 and status = 'open'", [MSG_H2]);
    const r = await one(tx, "select (public.resolve_report($1, 'warned')).status as s", [rep.id]);
    await tx.exec("reset role");
    const n = await count(tx, "select count(*) from public.notifications where type = 'moderation_warning' and recipient_id = $1", [rep.message_author_id]);
    return r.s === "resolved" && n === 1;
  }), "Yasmine avertit l'autrice : signalement clos, notification envoyée");
  ok(await as(INES, async (tx) => {
    await tx.query("update public.message_reports set status = 'resolved', resolution = 'dismissed'");
    await tx.exec("reset role");
    return count(tx, "select count(*) from public.message_reports where status = 'open'");
  }) === 3, "Inès ne clôt aucun signalement");
  const openReport = (await one(db, "select id from public.message_reports where status = 'open' limit 1")).id;
  ok(await rejects(INES, "select public.resolve_report($1, 'dismissed')", [openReport]), "…même par la fonction");

  console.log("\nLot 1 · Actualités");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.news_posts")) === 4, "Inès voit les 4 publications publiées, pas le brouillon");
  ok(await as(JULIA, (tx) => count(tx, "select count(*) from public.news_posts")) === 5, "Julia (admin) voit aussi le brouillon");
  ok(await as(RIM, (tx) => count(tx, "select count(*) from public.news_posts")) === 0, "Rim (hors cercle) ne voit pas les actualités");
  ok(await rejects(null, "select * from public.news_posts"), "anonyme : actualités interdites");
  ok(await rejects(INES, "insert into public.news_posts (title, body, status, published_at) values ('Test', 'x', 'published', now())"), "Inès ne publie pas");
  ok(await as(JULIA, async (tx) => {
    await tx.query("insert into public.news_posts (title, body, author_id) values ('Nouveau brouillon', 'Texte', $1)", [JULIA]);
    await tx.query("update public.news_posts set status = 'published', published_at = now(), pinned = true where title = 'Nouveau brouillon'");
    return count(tx, "select count(*) from public.news_posts where pinned");
  }) === 2, "Julia crée, publie et épingle une publication");
  ok(await rejects(JULIA, "update public.news_posts set status = 'published' where status = 'draft'"), "une publication publiée a toujours une date de publication");
  ok(await as(INES, async (tx) => {
    const post = await one(tx, "select id from public.news_posts limit 1");
    await tx.query("insert into public.news_reactions (post_id, profile_id, kind) values ($1, $2, 'like')", [post.id, INES]);
    const n1 = await count(tx, "select count(*) from public.news_reactions where profile_id = $1 and post_id = $2", [INES, post.id]);
    await tx.query("delete from public.news_reactions where post_id = $1 and profile_id = $2", [post.id, INES]);
    return n1 >= 1 && (await count(tx, "select count(*) from public.news_reactions where profile_id = $1 and post_id = $2", [INES, post.id])) === 0;
  }), "Inès réagit à une publication puis retire sa réaction");
  ok(await rejects(INES, "insert into public.news_reactions (post_id, profile_id, kind) select id, $1, 'bravo' from public.news_posts limit 1", [SALMA]), "Inès ne réagit pas au nom de Salma");
  ok(await rejects(INES, "insert into public.news_reactions (post_id, profile_id, kind) values ($1, $2, 'like')", [uuid("news-family"), INES]), "…ni sur un brouillon");

  const SAISON = uuid("news-saison");
  const BLOOM = uuid("news-bloom");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.news_comments where post_id = $1", [SAISON])) === 2, "Inès lit les commentaires d'une publication");
  ok(await as(RIM, (tx) => count(tx, "select count(*) from public.news_comments")) === 0, "Rim (hors cercle) ne lit pas les commentaires");
  ok(await as(INES, async (tx) => {
    await tx.query("insert into public.news_comments (post_id, author_id, body) values ($1, $2, 'Bravo !')", [SAISON, INES]);
    return count(tx, "select count(*) from public.news_comments where post_id = $1", [SAISON]);
  }) === 3, "Inès commente une publication ouverte aux commentaires");
  ok(await rejects(INES, "insert into public.news_comments (post_id, author_id, body) values ($1, $2, 'Bravo !')", [BLOOM, INES]), "…pas une publication aux commentaires fermés");
  ok(await rejects(INES, "insert into public.news_comments (post_id, author_id, body) values ($1, $2, 'Faux')", [SAISON, SALMA]), "…ni au nom de Salma");
  ok(await as(INES, async (tx) => {
    await tx.query("delete from public.news_comments where post_id = $1", [SAISON]);
    return count(tx, "select count(*) from public.news_comments where post_id = $1", [SAISON]);
  }) === 2, "Inès ne retire pas les commentaires des autres");
  ok(await as(YASMINE, async (tx) => {
    await tx.query("delete from public.news_comments where post_id = $1", [SAISON]);
    return count(tx, "select count(*) from public.news_comments where post_id = $1", [SAISON]);
  }) === 0, "Yasmine (modératrice) retire un commentaire");

  console.log("\nLot 1 · Annuaire et confidentialité");
  const dirInes = await as(INES, async (tx) => (await tx.query("select * from public.directory_list()")).rows);
  ok(dirInes.length > 50, `Inès voit l'annuaire (${dirInes.length} fiches)`);
  ok(!dirInes.some((r) => r.id === AURELIE), "…sans Aurélie, qui a masqué sa fiche");
  const lou = dirInes.find((r) => r.id === LOU);
  ok(lou && lou.limited && lou.job && !lou.bio && !lou.sector && !lou.skills.length, "Lou (« nom et métier ») : seuls son nom et son métier sont visibles");
  const julia = dirInes.find((r) => r.id === JULIA);
  ok(julia && julia.email && julia.is_founder, "l'e-mail de Julia est visible (elle l'a choisi)");
  const dirSalma = await as(SALMA, async (tx) => (await tx.query("select * from public.directory_list()")).rows);
  ok(dirSalma.find((r) => r.id === INES)?.whatsapp === "+212 6 61 42 18 07", "le WhatsApp d'Inès est visible (elle l'a choisi)");
  ok(dirSalma.find((r) => r.id === G01)?.whatsapp && !dirSalma.find((r) => r.id === G02)?.whatsapp, "…et celui des membres qui ne l'ont pas choisi reste masqué");
  ok((await as(JULIA, async (tx) => (await tx.query("select * from public.directory_list() where id = $1", [AURELIE])).rows.length)) === 1, "Julia (admin) voit toutes les fiches, même masquées");
  ok((await as(RIM, async (tx) => (await tx.query("select * from public.directory_list()")).rows.length)) === 0, "Rim (hors cercle) ne voit pas l'annuaire");
  ok(await as(INES, (tx) => count(tx, "select count(*) from public.directory_profiles where profile_id <> $1", [INES])) === 0, "Inès ne lit pas les réglages des autres");
  ok(await as(INES, async (tx) => {
    await tx.query("update public.directory_profiles set visibility = 'basic', skills = array['Presse', 'Marque'] where profile_id = $1", [INES]);
    await tx.query("update public.directory_profiles set visibility = 'hidden' where profile_id = $1", [SALMA]);
    await tx.query("update public.profiles set job = 'Consultante', bio = 'Nouvelle bio' where id = $1", [INES]);
    const mine = await one(tx, "select visibility from public.directory_profiles where profile_id = $1", [INES]);
    await switchTo(tx, SALMA);
    const salma = await one(tx, "select visibility from public.directory_profiles where profile_id = $1", [SALMA]);
    return mine.visibility === "basic" && salma.visibility === "all";
  }), "Inès modifie sa fiche et sa confidentialité, pas celles de Salma");

  console.log("\nLot 1 · Rappels et liste d'attente");
  ok(await rejects(INES, "insert into public.event_reminders (event_id, profile_id) select id, $1 from public.events limit 1", [INES]), "une membre n'enregistre pas de rappel");
  ok(await as(JULIA, async (tx) => {
    await tx.query("insert into public.event_reminders (event_id, profile_id) select id, $1 from public.events where status = 'published' limit 1", [INES]);
    return count(tx, "select count(*) from public.event_reminders");
  }) === 1, "l'administratrice enregistre les rappels envoyés");
  ok(await db.transaction(async (tx) => {
    const ev = await one(tx, "insert into public.events (slug, title, starts_at, capacity, venue, status) values ('test-attente', 'Test attente', now() + interval '10 days', 1, 'Fer7', 'published') returning id");
    await tx.query("insert into public.bookings (event_id, profile_id, status, amount, method, ticket_code) values ($1, $2, 'paid', 0, 'free', 'NC-2911-WXYZ')", [ev.id, SALMA]);
    await tx.query("insert into public.bookings (event_id, profile_id, status, amount, method, ticket_code) values ($1, $2, 'waitlist', 0, 'free', 'NC-2911-WXYQ')", [ev.id, INES]);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [INES]);
    await tx.exec("set local role authenticated");
    const before = (await one(tx, "select public.book_event($1) as r", [ev.id])).r;
    await tx.exec("reset role");
    await tx.query("update public.bookings set status = 'cancelled' where ticket_code = 'NC-2911-WXYZ'");
    await tx.exec("set local role authenticated");
    const after = (await one(tx, "select public.book_event($1) as r", [ev.id])).r;
    const mine = await count(tx, "select count(*) from public.bookings where event_id = $1 and profile_id = $2 and status = 'paid'", [ev.id, INES]);
    await tx.rollback();
    return before.status === "already" && after.status === "booked" && mine === 1;
  }), "place libérée : la personne en liste d'attente peut la réserver");
}
