import { nowMs } from "./clock";
import { fullName, messageTime } from "./format";
import type { Message, Profile } from "./types";

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
};

export type ChatTarget = { kind: "general" } | { kind: "dm"; otherId: string };

export function toChatMsg(m: Message, author: Profile | null, meId: string): ChatMsg {
  return {
    id: m.id,
    at: m.createdAt,
    authorId: m.authorId,
    author: author ? fullName(author) : "Membre",
    founder: author?.role === "founder",
    body: m.body,
    time: messageTime(m.createdAt, nowMs()),
    mine: m.authorId === meId,
  };
}

