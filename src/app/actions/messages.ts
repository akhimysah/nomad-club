"use server";

import { revalidatePath } from "next/cache";
import { checkCapability } from "@/lib/auth";
import { toChatMsg, type ChatMsg, type ChatTarget } from "@/lib/chat";
import { nowMs } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { dmChannel } from "@/lib/data/repo";
import { eventGroupLabel } from "@/lib/domain/events";
import { dayNumber } from "@/lib/format";
import { messageSchema } from "@/lib/validation";
import { inCircle } from "@/lib/permissions";
import { groupChannel } from "@/lib/modules/communaute/domain";

async function memberOrNull() {
  return checkCapability("messages.post");
}

async function channelFor(target: ChatTarget, meId: string): Promise<string | null> {
  if (target.kind === "general") return "general";
  // --- Lot 1 --- groupe thématique : réservé à ses membres
  if (target.kind === "group") {
    const g = await getRepo().getGroup(target.groupId, meId);
    return g && g.myStatus === "member" ? groupChannel(g.id) : null;
  }
  if (target.otherId === meId) return null;
  const other = await getRepo().getProfile(target.otherId);
  if (!other || !inCircle(other)) return null;
  return dmChannel(meId, other.id);
}

/** Poster au salon Général ou envoyer un message privé (adhérentes uniquement). */
export async function sendMessage(target: ChatTarget, body: string): Promise<{ ok: true; msg: ChatMsg; notice?: string } | { ok: false; error: string }> {
  const v = await memberOrNull();
  if (!v) return { ok: false, error: "Réservé aux adhérentes." };
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Ton message est vide." };
  const channel = await channelFor(target, v.profile.id);
  if (!channel) return { ok: false, error: "Conversation introuvable." };
  const m = await getRepo().postMessage(channel, v.profile.id, parsed.data);
  // Lot 1 : modération par mots-clés (masquer et signaler, ou signaler seulement)
  const mod = await getRepo().applyKeywordModeration(m);
  revalidatePath("/espace", "layout");
  const msg = toChatMsg({ ...m, hiddenAt: mod.hidden ? m.createdAt : null }, v.profile, v.profile.id);
  return mod.hidden ? { ok: true, msg, notice: "Ton message est masqué : il contient un mot réservé à la modération." } : { ok: true, msg };
}

const SALON_REPLIES: Array<[string, string]> = [
  ["p-julia", "Bien noté ! On en parle au prochain rendez-vous."],
  ["p-chloe", "Je suis partante, dis-moi quand."],
  ["p-nora", "Merci pour ton message. Je te réponds en privé si besoin."],
  ["p-yasmine", "Bonne idée ! Je relaie autour de moi."],
];

const GROUP_REPLIES = ["Merci pour le partage !", "Je suis intéressée, on en reparle au prochain rendez-vous ?", "Très bonne idée, je note.", "Je t’écris en privé pour les détails."];

/**
 * Démo uniquement : une autre membre répond (le salon paraît vivant).
 * La réponse est enregistrée comme un vrai message. Aucun effet en mode réel.
 */
export async function demoReply(target: ChatTarget): Promise<ChatMsg | null> {
  const v = await memberOrNull();
  if (!v || v.mode !== "demo") return null;
  const repo = getRepo();
  const channel = await channelFor(target, v.profile.id);
  if (!channel) return null;
  let authorId: string;
  let body: string;
  if (target.kind === "general") {
    const count = (await repo.listMessages("general")).filter((m) => m.authorId === v.profile.id).length;
    [authorId, body] = SALON_REPLIES[(count - 1 + SALON_REPLIES.length) % SALON_REPLIES.length];
    if (authorId === v.profile.id) authorId = "p-nora";
  } else if (target.kind === "group") {
    // --- Lot 1 --- une autre membre du groupe répond
    const others = (await repo.listGroupMembers(target.groupId)).filter((x) => x.status === "member" && x.profile.id !== v.profile.id);
    if (!others.length) return null;
    const count = (await repo.listMessages(channel)).length;
    authorId = others[count % others.length].profile.id;
    body = GROUP_REPLIES[count % GROUP_REPLIES.length];
  } else {
    authorId = target.otherId;
    const next = (await repo.listBookingsForProfile(v.profile.id)).find((b) => b.status !== "waitlist" && b.event.startsAt > new Date(nowMs()).toISOString());
    const label = next ? eventGroupLabel(next.event, String(dayNumber(next.event.startsAt))) : null;
    body = `Avec plaisir, ${v.profile.firstName} ! On en parle ${label ? `au ${label.charAt(0).toLowerCase() + label.slice(1)}` : "au prochain rendez-vous"} ?`;
  }
  const author = await repo.getProfile(authorId);
  if (!author) return null;
  const m = await repo.postMessage(channel, authorId, body);
  // La réponse s'affiche dans le fil ouvert : elle est donc lue.
  if (target.kind === "dm") await repo.markDmRead(v.profile.id, authorId);
  return toChatMsg(m, author, v.profile.id);
}

/** Marque une conversation privée comme lue. */
export async function markThreadRead(otherId: string): Promise<void> {
  const v = await memberOrNull();
  if (!v) return;
  await getRepo().markDmRead(v.profile.id, otherId);
  revalidatePath("/espace", "layout");
}
