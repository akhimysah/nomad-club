import { nowMs } from "./clock";
import { fullName, messageTime } from "./format";
import type { Message, Profile } from "./types";
import { isAdmin } from "./permissions";
import { HIDDEN_LABEL } from "./modules/communaute/domain";

/** Message prêt à afficher dans le salon ou une conversation privée. */
export type ChatMsg = {
  id: string;
  at: string;
  authorId: string;
  author: string;
  founder: boolean;
  body: string;
  time: string;
  mine: boolean;
  /** Lot 1 : masqué par la modération (le texte d'origine n'est pas transmis). */
  hidden: boolean;
};

export type ChatTarget = { kind: "general" } | { kind: "dm"; otherId: string } | { kind: "group"; groupId: string } /* Lot 1 */;

export function toChatMsg(m: Message, author: Profile | null, meId: string): ChatMsg {
  return {
    id: m.id,
    at: m.createdAt,
    authorId: m.authorId,
    author: author ? fullName(author) : "Membre",
    founder: isAdmin(author),
    body: m.hiddenAt ? HIDDEN_LABEL : m.body,
    time: messageTime(m.createdAt, nowMs()),
    mine: m.authorId === meId,
    hidden: Boolean(m.hiddenAt),
  };
}
