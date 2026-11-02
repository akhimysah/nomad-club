"use client";

import { useState } from "react";
import { toggleReactionAction } from "@/app/actions/communaute";
import { REACTION_LABEL } from "@/lib/modules/communaute/domain";
import { REACTION_KINDS, type NewsPostView, type ReactionKind } from "@/lib/modules/communaute/types";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

export type NewsItem = NewsPostView & { dateLabel: string };

function Reactions({ post, onChange, readOnly }: { post: NewsItem; onChange: (p: NewsItem) => void; readOnly?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<ReactionKind | null>(null);
  const toggle = async (k: ReactionKind) => {
    if (busy || readOnly) return;
    setBusy(k);
    // affichage immédiat, confirmé par le serveur
    const on = post.mine.includes(k);
    onChange({ ...post, mine: on ? post.mine.filter((x) => x !== k) : [...post.mine, k], reactions: { ...post.reactions, [k]: post.reactions[k] + (on ? -1 : 1) } });
    const r = await toggleReactionAction(post.id, k);
    setBusy(null);
    if (!r.ok) {
      onChange(post);
      toast(r.error, "bell");
      return;
    }
    onChange({ ...r.post, dateLabel: post.dateLabel });
  };
  return (
    <div className="cm-reacts" role="group" aria-label="Réactions">
      {REACTION_KINDS.map((k) => (
        <button key={k} type="button" className={"cm-react" + (post.mine.includes(k) ? " on" : "")} aria-pressed={post.mine.includes(k)} onClick={() => toggle(k)} disabled={readOnly}>
          <span className="sign" aria-hidden="true">
            {REACTION_LABEL[k].sign}
          </span>
          {REACTION_LABEL[k].label}
          <b>{post.reactions[k] || ""}</b>
        </button>
      ))}
    </div>
  );
}

function Post({ post: initial, readOnly }: { post: NewsItem; readOnly?: boolean }) {
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(false);
  const long = post.body.length > 420;
  return (
    <article className="card cm-post" id={`post-${post.id}`}>
      {post.image && (
        <div className="cm-media">
          <img src={post.image} alt="" />
        </div>
      )}
      <div className="cm-body">
        <div className="cm-meta">
          {post.pinned && (
            <span className="chip solid">
              <Icon name="star" />
              Épinglé
            </span>
          )}
          {post.status === "draft" && <span className="chip">Brouillon</span>}
          <span>
            {post.authorName} · {post.dateLabel}
          </span>
        </div>
        <h2>{post.title}</h2>
        <p className={"cm-text" + (long && !open ? " clamp" : "")}>{post.body}</p>
        {long && (
          <button type="button" className="link" onClick={() => setOpen((o) => !o)}>
            {open ? "Réduire" : "Lire la suite"}
          </button>
        )}
        <Reactions post={post} onChange={setPost} readOnly={readOnly || post.status !== "published"} />
      </div>
    </article>
  );
}

/** Fil d'actualités du club : épinglées d'abord, réactions simples. */
export function NewsFeed({ posts, readOnly }: { posts: NewsItem[]; readOnly?: boolean }) {
  if (!posts.length)
    return (
      <div className="empty">
        <Icon name="star" />
        Pas encore d’actualité. Les fondatrices publient ici les nouvelles du club.
      </div>
    );
  return (
    <div className="cm-feed">
      {posts.map((p) => (
        <Post key={p.id} post={p} readOnly={readOnly} />
      ))}
    </div>
  );
}
