// Lot 1 — Communauté : partie du seed SQL générée depuis src/lib/modules/communaute/seed.ts.
// Appelé par scripts/seed-sql.mjs (après les messages et notifications, qui contiennent déjà ceux du module).

/**
 * @param {ReturnType<typeof import("../../src/lib/seed.ts").createSeed>} s
 * @param {{ uuid: (id: string | null) => string | null, q: (v: unknown) => string, arr: (a: string[]) => string, out: (line: string) => void, insert: (table: string, cols: string[], rows: string[][], conflict?: string) => void }} h
 */
export function communauteSeedSql(s, { uuid, q, arr, out, insert }) {
  const c = s.communaute;
  out("-- Lot 1 — Communauté (0004_communaute.sql) : annuaire, actualités, groupes, modération.");

  insert(
    "directory_profiles",
    ["profile_id", "company", "sector", "skills", "instagram", "linkedin", "website", "looking_for", "offering", "visibility", "show_whatsapp", "show_email", "updated_at"],
    c.directory.map((d) => [q(uuid(d.profileId)), q(d.company), q(d.sector), arr(d.skills), q(d.instagram), q(d.linkedin), q(d.website), q(d.lookingFor), q(d.offering), q(d.visibility), q(d.showWhatsapp), q(d.showEmail), q(d.updatedAt)]),
  );

  insert(
    "news_posts",
    ["id", "title", "body", "image", "pinned", "status", "author_id", "published_at", "created_at", "updated_at"],
    c.news.map((n) => [q(uuid(n.id)), q(n.title), q(n.body), q(n.image), q(n.pinned), q(n.status), q(uuid(n.authorId)), q(n.publishedAt), q(n.createdAt), q(n.updatedAt)]),
  );

  insert(
    "news_reactions",
    ["post_id", "profile_id", "kind", "created_at"],
    c.reactions.map((r) => [q(uuid(r.postId)), q(uuid(r.profileId)), q(r.kind), q(r.createdAt)]),
  );

  insert(
    "chat_groups",
    ["id", "slug", "name", "description", "icon", "join_policy", "listed", "created_by", "created_at", "archived_at"],
    c.groups.map((g) => [q(uuid(g.id)), q(g.slug), q(g.name), q(g.description), q(g.icon), q(g.joinPolicy), q(g.listed), q(uuid(g.createdBy)), q(g.createdAt), q(g.archivedAt)]),
  );

  insert(
    "chat_group_members",
    ["group_id", "profile_id", "status", "created_at", "decided_by", "decided_at"],
    c.groupMembers.map((m) => [q(uuid(m.groupId)), q(uuid(m.profileId)), q(m.status), q(m.createdAt), q(uuid(m.decidedBy)), q(m.decidedAt)]),
  );

  // Messages masqués : le texte d'origine est mis de côté (les messages eux-mêmes sont déjà insérés).
  for (const m of s.messages.filter((x) => x.hiddenAt)) {
    out(`update public.messages set hidden_at = ${q(m.hiddenAt)}, hidden_reason = 'Mot-clé' where id = ${q(uuid(m.id))};`);
  }
  insert(
    "message_originals",
    ["message_id", "body"],
    c.hiddenBodies.map((h) => [q(uuid(h.messageId)), q(h.body)]),
  );

  // Mots-clés après les messages : le déclencheur de modération ne repasse pas sur les messages d'exemple.
  insert(
    "moderation_keywords",
    ["id", "keyword", "action", "created_by", "created_at"],
    c.keywords.map((k) => [q(uuid(k.id)), q(k.keyword), q(k.action), q(uuid(k.createdBy)), q(k.createdAt)]),
  );

  // Signalements d'exemple : la modération a déjà été prévenue (notifications d'exemple), on coupe le déclencheur le temps de l'insertion.
  out("alter table public.message_reports disable trigger message_reports_notify;");
  insert(
    "message_reports",
    ["id", "message_id", "reporter_id", "source", "reason", "keyword", "message_body", "message_author_id", "channel", "status", "resolution", "resolved_by", "resolved_at", "created_at"],
    c.reports.map((r) => [
      q(uuid(r.id)), q(uuid(r.messageId)), q(uuid(r.reporterId)), q(r.source), q(r.reason), q(r.keyword), q(r.messageBody), q(uuid(r.messageAuthorId)),
      q(r.channel.startsWith("group:") ? "group:" + uuid(r.channel.slice(6)) : r.channel), q(r.status), q(r.resolution), q(uuid(r.resolvedBy)), q(r.resolvedAt), q(r.createdAt),
    ]),
  );
  out("alter table public.message_reports enable trigger message_reports_notify;");
  out("");

  insert(
    "event_reminders",
    ["event_id", "profile_id", "sent_at"],
    c.remindersSent.map((r) => [q(uuid(r.eventId)), q(uuid(r.profileId)), q(r.sentAt)]),
  );
}
