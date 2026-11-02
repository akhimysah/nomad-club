"use server";

/**
 * Lot 1 — Communauté : server actions (actualités, groupes, modération, annuaire, rappels).
 * Chaque action vérifie sa capacité (checkCapability), journalise ce qui compte et revalide les pages.
 */
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { checkCapability, viewerCan } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { fullName } from "@/lib/format";
import { groupIdOfChannel } from "@/lib/modules/communaute/domain";
import { notifyNewsPublished, sendEventReminders, type ReminderRun } from "@/lib/modules/communaute/service";
import type { NewsCommentView, NewsPostView, ReactionKind, ReportResolution } from "@/lib/modules/communaute/types";
import { commentSchema, groupSchema, keywordSchema, newsSchema, profileSchema, reactionSchema, reportSchema, type GroupForm, type NewsForm, type ProfileForm } from "@/lib/modules/communaute/validation";

export type CommunauteResult = { ok: true; message: string; id?: string } | { ok: false; error: string };

const fail = (error: string): CommunauteResult => ({ ok: false, error });
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Une erreur est survenue.");

function revalidateCommunity() {
  revalidatePath("/espace", "layout");
  revalidatePath("/fondatrices", "layout");
}

/* ---------------- actualités ---------------- */

export async function toggleReactionAction(postId: string, kind: ReactionKind): Promise<{ ok: true; post: NewsPostView } | { ok: false; error: string }> {
  const v = await checkCapability("news.react");
  if (!v) return { ok: false, error: "Réservé aux adhérentes." };
  const k = reactionSchema.safeParse(kind);
  if (!k.success) return { ok: false, error: "Réaction inconnue." };
  const repo = getRepo();
  try {
    await repo.toggleReaction(postId, v.profile.id, k.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  const post = await repo.getNews(postId, v.profile.id);
  revalidatePath("/espace", "layout");
  return post ? { ok: true, post } : { ok: false, error: "Publication introuvable." };
}

/** Commentaires d'une publication visible par la personne. */
export async function listNewsCommentsAction(postId: string): Promise<{ ok: true; comments: NewsCommentView[] } | { ok: false; error: string }> {
  const v = await checkCapability("news.react");
  if (!v) return { ok: false, error: "Réservé aux adhérentes." };
  const post = await getRepo().getNews(postId, v.profile.id);
  if (!post || (post.status !== "published" && !viewerCan(v, "news.manage"))) return { ok: false, error: "Publication introuvable." };
  return { ok: true, comments: await getRepo().listNewsComments(postId) };
}

export async function addNewsCommentAction(postId: string, body: string): Promise<{ ok: true; comment: NewsCommentView } | { ok: false; error: string }> {
  const v = await checkCapability("news.react");
  if (!v) return { ok: false, error: "Réservé aux adhérentes." };
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Commentaire vide." };
  try {
    const comment = await getRepo().addNewsComment(postId, v.profile.id, parsed.data);
    revalidatePath("/espace", "layout");
    return { ok: true, comment };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Retirer un commentaire : le sien, ou n'importe lequel pour la modération (journalisé). L'autrice est vérifiée côté serveur. */
export async function deleteNewsCommentAction(postId: string, id: string): Promise<CommunauteResult> {
  const v = await checkCapability("news.react");
  if (!v) return fail("Réservé aux adhérentes.");
  const repo = getRepo();
  const target = (await repo.listNewsComments(postId)).find((x) => x.id === id);
  if (!target) return fail("Commentaire introuvable.");
  const own = target.authorId === v.profile.id;
  if (!own && !viewerCan(v, "messages.moderate")) return fail("Tu ne peux retirer que tes commentaires.");
  const removed = await repo.deleteNewsComment(id);
  if (!removed) return fail("Commentaire introuvable.");
  if (!own) {
    await audit({
      actorId: v.profile.id,
      action: "moderation.hide",
      targetType: "news",
      targetId: postId,
      summary: `Commentaire retiré · ${target.authorName}`,
      details: { excerpt: target.body.slice(0, 120) },
    });
  }
  revalidatePath("/espace", "layout");
  return { ok: true, message: "Commentaire retiré." };
}

/** Créer ou modifier une publication ; `publish` la publie aussi (notification aux membres la première fois). */
export async function saveNewsAction(form: NewsForm, opts: { id?: string; publish?: boolean } = {}): Promise<CommunauteResult> {
  const v = await checkCapability("news.manage");
  if (!v) return fail("Réservé aux fondatrices.");
  const parsed = newsSchema.safeParse(form);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const repo = getRepo();
  const me = v.profile;
  try {
    if (opts.id) {
      const before = await repo.getNews(opts.id, null);
      if (!before) return fail("Publication introuvable.");
      let post = await repo.updateNews(opts.id, parsed.data);
      await audit({ actorId: me.id, action: "news.update", targetType: "news", targetId: post.id, summary: `Publication « ${post.title} » modifiée` });
      if (opts.publish && post.status !== "published") {
        post = await repo.setNewsStatus(post.id, "published");
        await audit({ actorId: me.id, action: "news.publish", targetType: "news", targetId: post.id, summary: `Publication « ${post.title} » publiée par ${fullName(me)}` });
        if (!before.publishedAt) await notifyNewsPublished(post, me.id);
      }
      revalidateCommunity();
      return { ok: true, message: opts.publish ? "Publication en ligne." : "Modifications enregistrées.", id: post.id };
    }
    const post = await repo.createNews(parsed.data, me.id, opts.publish ? "published" : "draft");
    await audit({ actorId: me.id, action: opts.publish ? "news.publish" : "news.create", targetType: "news", targetId: post.id, summary: `Publication « ${post.title} » ${opts.publish ? "publiée" : "créée en brouillon"} par ${fullName(me)}` });
    if (opts.publish) await notifyNewsPublished(post, me.id);
    revalidateCommunity();
    return { ok: true, message: opts.publish ? "Publication en ligne : les membres sont prévenues." : "Brouillon enregistré.", id: post.id };
  } catch (e) {
    return fail(errMsg(e));
  }
}

export async function setNewsStatusAction(id: string, status: "published" | "draft"): Promise<CommunauteResult> {
  const v = await checkCapability("news.manage");
  if (!v) return fail("Réservé aux fondatrices.");
  const repo = getRepo();
  const before = await repo.getNews(id, null);
  if (!before) return fail("Publication introuvable.");
  const post = await repo.setNewsStatus(id, status);
  await audit({
    actorId: v.profile.id,
    action: status === "published" ? "news.publish" : "news.update",
    targetType: "news",
    targetId: id,
    summary: `Publication « ${post.title} » ${status === "published" ? "publiée" : "repassée en brouillon"}`,
  });
  if (status === "published" && !before.publishedAt) await notifyNewsPublished(post, v.profile.id);
  revalidateCommunity();
  return { ok: true, message: status === "published" ? "Publication en ligne." : "Repassée en brouillon." };
}

export async function pinNewsAction(id: string, pinned: boolean): Promise<CommunauteResult> {
  const v = await checkCapability("news.manage");
  if (!v) return fail("Réservé aux fondatrices.");
  const post = await getRepo().setNewsPinned(id, pinned);
  await audit({ actorId: v.profile.id, action: "news.update", targetType: "news", targetId: id, summary: `Publication « ${post.title} » ${pinned ? "épinglée" : "désépinglée"}` });
  revalidateCommunity();
  return { ok: true, message: pinned ? "Épinglée en haut du fil." : "Désépinglée." };
}

export async function deleteNewsAction(id: string): Promise<CommunauteResult> {
  const v = await checkCapability("news.manage");
  if (!v) return fail("Réservé aux fondatrices.");
  const repo = getRepo();
  const post = await repo.getNews(id, null);
  if (!post) return fail("Publication introuvable.");
  await repo.deleteNews(id);
  await audit({ actorId: v.profile.id, action: "news.delete", targetType: "news", targetId: null, summary: `Publication « ${post.title} » supprimée` });
  revalidateCommunity();
  return { ok: true, message: "Publication supprimée." };
}

/* ---------------- groupes ---------------- */

export async function joinGroupAction(groupId: string): Promise<CommunauteResult> {
  const v = await checkCapability("groups.join");
  if (!v) return fail("Réservé aux adhérentes.");
  try {
    const status = await getRepo().joinGroup(groupId, v.profile.id);
    revalidateCommunity();
    return { ok: true, message: status === "member" ? "Bienvenue dans le groupe !" : "Demande envoyée : la modération te répond vite." };
  } catch (e) {
    return fail(errMsg(e));
  }
}

export async function leaveGroupAction(groupId: string): Promise<CommunauteResult> {
  const v = await checkCapability("groups.join");
  if (!v) return fail("Réservé aux adhérentes.");
  await getRepo().leaveGroup(groupId, v.profile.id);
  revalidateCommunity();
  return { ok: true, message: "Tu as quitté le groupe." };
}

export async function saveGroupAction(form: GroupForm, id?: string): Promise<CommunauteResult> {
  const v = await checkCapability("groups.manage");
  if (!v) return fail("Réservé à la modération.");
  const parsed = groupSchema.safeParse(form);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  const repo = getRepo();
  try {
    const g = id ? await repo.updateGroup(id, parsed.data) : await repo.createGroup(parsed.data, v.profile.id);
    await audit({
      actorId: v.profile.id,
      action: id ? "group.update" : "group.create",
      targetType: "group",
      targetId: g.id,
      summary: `Groupe « ${g.name} » ${id ? "modifié" : "créé"} (${g.joinPolicy === "open" ? "ouvert" : "sur demande"}${g.listed ? "" : ", privé"})`,
    });
    revalidateCommunity();
    return { ok: true, message: id ? "Groupe enregistré." : "Groupe créé.", id: g.id };
  } catch (e) {
    return fail(errMsg(e));
  }
}

export async function archiveGroupAction(id: string, archived: boolean): Promise<CommunauteResult> {
  const v = await checkCapability("groups.manage");
  if (!v) return fail("Réservé à la modération.");
  const g = await getRepo().updateGroup(id, { archived });
  await audit({ actorId: v.profile.id, action: "group.update", targetType: "group", targetId: id, summary: `Groupe « ${g.name} » ${archived ? "archivé" : "rouvert"}` });
  revalidateCommunity();
  return { ok: true, message: archived ? "Groupe archivé." : "Groupe rouvert." };
}

export async function decideGroupRequestAction(groupId: string, profileId: string, approve: boolean): Promise<CommunauteResult> {
  const v = await checkCapability("groups.manage");
  if (!v) return fail("Réservé à la modération.");
  const repo = getRepo();
  const [g, p] = await Promise.all([repo.getGroup(groupId, v.profile.id, { manage: true }), repo.getProfile(profileId)]);
  if (!g || !p) return fail("Demande introuvable.");
  const done = await repo.decideGroupRequest(groupId, profileId, approve, v.profile.id);
  if (!done) return fail("Cette demande a déjà été traitée.");
  await audit({ actorId: v.profile.id, action: "group.decide", targetType: "group", targetId: groupId, summary: `${fullName(p)} ${approve ? "acceptée" : "refusée"} dans « ${g.name} »`, details: { profileId, approve } });
  revalidateCommunity();
  return { ok: true, message: approve ? `${p.firstName} rejoint le groupe.` : "Demande refusée." };
}

/* ---------------- signalements et modération ---------------- */

/** Une membre signale un message qu'elle peut lire (pas le sien). */
export async function reportMessageAction(messageId: string, reason: string): Promise<CommunauteResult> {
  const v = await checkCapability("messages.report");
  if (!v) return fail("Réservé aux adhérentes.");
  const r = reportSchema.safeParse(reason);
  if (!r.success) return fail(r.error.issues[0]?.message ?? "Motif manquant.");
  const repo = getRepo();
  const m = await repo.getMessage(messageId);
  if (!m) return fail("Message introuvable.");
  const me = v.profile.id;
  const gid = groupIdOfChannel(m.channel);
  const readable =
    m.channel === "general" ||
    (m.channel.startsWith("dm:") && m.channel.includes(me)) ||
    (!!gid && ((await repo.getGroup(gid, me))?.myStatus === "member" || viewerCan(v, "messages.moderate")));
  if (!readable) return fail("Message introuvable.");
  if (m.authorId === me) return fail("Tu ne peux pas signaler ton propre message.");
  try {
    await repo.reportMessage(messageId, me, r.data);
  } catch (e) {
    return fail(errMsg(e));
  }
  revalidateCommunity();
  return { ok: true, message: "Merci, la modération va regarder ce message." };
}

export type ModerationKind = "hide" | "restore" | "warn" | "dismiss";

const RESOLUTION: Record<ModerationKind, ReportResolution> = { hide: "hidden", restore: "restored", warn: "warned", dismiss: "dismissed" };
const AUDIT_ACTION = { hide: "moderation.hide", restore: "moderation.restore", warn: "moderation.warn", dismiss: "moderation.dismiss" } as const;

/** Traiter un signalement de la file : masquer, rétablir, avertir l'autrice, classer sans suite. */
export async function moderateReportAction(reportId: string, kind: ModerationKind): Promise<CommunauteResult> {
  const v = await checkCapability("messages.moderate");
  if (!v) return fail("Réservé à la modération.");
  const repo = getRepo();
  const report = (await repo.listReports({ status: "all" })).find((r) => r.id === reportId);
  if (!report) return fail("Signalement introuvable.");
  try {
    if (kind === "hide") await repo.hideMessage(report.messageId, v.profile.id, report.reason || "Masqué par la modération");
    if (kind === "restore") await repo.restoreMessage(report.messageId, v.profile.id);
    await repo.resolveReport(reportId, RESOLUTION[kind], v.profile.id);
  } catch (e) {
    return fail(errMsg(e));
  }
  const author = await repo.getProfile(report.messageAuthorId);
  await audit({
    actorId: v.profile.id,
    action: AUDIT_ACTION[kind],
    targetType: "message",
    targetId: report.messageId,
    summary: `${{ hide: "Message masqué", restore: "Message rétabli", warn: "Avertissement envoyé", dismiss: "Signalement classé" }[kind]} · ${author ? fullName(author) : "Membre"}`,
    details: { reportId, reason: report.reason, excerpt: report.messageBody.slice(0, 120) },
  });
  revalidateCommunity();
  return { ok: true, message: { hide: "Message masqué.", restore: "Message rétabli.", warn: "Avertissement envoyé à l’autrice.", dismiss: "Signalement classé sans suite." }[kind] };
}

/** Masquer ou rétablir un message directement depuis une conversation (modératrices). */
export async function moderateMessageAction(messageId: string, kind: "hide" | "restore"): Promise<CommunauteResult> {
  const v = await checkCapability("messages.moderate");
  if (!v) return fail("Réservé à la modération.");
  const repo = getRepo();
  const m = await repo.getMessage(messageId);
  if (!m) return fail("Message introuvable.");
  const ok = kind === "hide" ? await repo.hideMessage(messageId, v.profile.id, "Masqué par la modération") : await repo.restoreMessage(messageId, v.profile.id);
  if (!ok) return fail("Rien à changer.");
  const author = await repo.getProfile(m.authorId);
  await audit({ actorId: v.profile.id, action: AUDIT_ACTION[kind], targetType: "message", targetId: messageId, summary: `${kind === "hide" ? "Message masqué" : "Message rétabli"} · ${author ? fullName(author) : "Membre"}` });
  revalidateCommunity();
  return { ok: true, message: kind === "hide" ? "Message masqué." : "Message rétabli." };
}

export async function addKeywordAction(keyword: string, action: "hide" | "flag"): Promise<CommunauteResult> {
  const v = await checkCapability("keywords.manage");
  if (!v) return fail("Réservé à la modération.");
  const parsed = keywordSchema.safeParse({ keyword, action });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Mot-clé invalide.");
  try {
    const k = await getRepo().addKeyword(parsed.data.keyword, parsed.data.action, v.profile.id);
    await audit({ actorId: v.profile.id, action: "keyword.add", targetType: "keyword", targetId: k.id, summary: `Mot-clé « ${k.keyword} » (${k.action === "hide" ? "masquer et signaler" : "signaler"})` });
    revalidateCommunity();
    return { ok: true, message: `« ${k.keyword} » ajouté.`, id: k.id };
  } catch (e) {
    return fail(errMsg(e));
  }
}

export async function removeKeywordAction(id: string): Promise<CommunauteResult> {
  const v = await checkCapability("keywords.manage");
  if (!v) return fail("Réservé à la modération.");
  const k = await getRepo().removeKeyword(id);
  if (!k) return fail("Mot-clé introuvable.");
  await audit({ actorId: v.profile.id, action: "keyword.remove", targetType: "keyword", targetId: null, summary: `Mot-clé « ${k.keyword} » retiré` });
  revalidateCommunity();
  return { ok: true, message: `« ${k.keyword} » retiré.` };
}

/* ---------------- annuaire : ma fiche ---------------- */

export async function saveProfileAction(form: ProfileForm): Promise<CommunauteResult> {
  const v = await checkCapability("directory.edit_own");
  if (!v) return fail("Réservé aux adhérentes.");
  const parsed = profileSchema.safeParse(form);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Formulaire incomplet.");
  try {
    await getRepo().updateOwnProfile(v.profile.id, parsed.data);
  } catch (e) {
    return fail(errMsg(e));
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Ta fiche est enregistrée." };
}

/* ---------------- rappels J-1 ---------------- */

export async function sendRemindersAction(eventId?: string): Promise<CommunauteResult & { run?: ReminderRun }> {
  const v = await checkCapability("events.remind");
  if (!v) return fail("Réservé aux fondatrices.");
  const run = await sendEventReminders({ eventId });
  await audit({
    actorId: v.profile.id,
    action: "event.remind",
    targetType: "event",
    targetId: eventId ?? null,
    summary: run.total ? `Rappels envoyés : ${run.total} inscrite${run.total > 1 ? "s" : ""} (${run.events.map((e) => e.title).join(", ")})` : "Rappels : personne à prévenir",
    details: { day: run.day, events: run.events },
  });
  revalidateCommunity();
  if (!run.events.length) return { ok: true, message: eventId ? "Ce rendez-vous n’est plus ouvert." : "Aucun rendez-vous demain : rien à envoyer.", run };
  return { ok: true, message: run.total ? `${run.total} rappel${run.total > 1 ? "s" : ""} envoyé${run.total > 1 ? "s" : ""}.` : "Toutes les inscrites ont déjà reçu le rappel.", run };
}
