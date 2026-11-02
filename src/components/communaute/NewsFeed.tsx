"use client";

import { useState } from "react";
import { addNewsCommentAction, deleteNewsCommentAction, listNewsCommentsAction, toggleReactionAction } from "@/app/actions/communaute";
import { REACTION_LABEL } from "@/lib/modules/communaute/domain";
import { REACTION_KINDS, type NewsCommentView, type NewsPostView, type ReactionKind } from "@/lib/modules/communaute/types";
import { Avatar } from "../ui/Avatar";
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

type Viewer = { meId?: string; canModerate?: boolean };

/** Commentaires d'une publication (chargés à l'ouverture). */
function Comments({ post, onCount, readOnly, meId, canModerate }: { post: NewsItem; onCount: (n: number) => void; readOnly?: boolean } & Viewer) {
  const toast = useToast();
  const [list, setList] = useState<NewsCommentView[] | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !list) {
      const r = await listNewsCommentsAction(post.id);
      if (r.ok) setList(r.comments);
      else toast(r.error, "bell");
    }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    const r = await addNewsCommentAction(post.id, text);
    setBusy(false);
    if (!r.ok) return toast(r.error, "bell");
    const l = [...(list ?? []), r.comment];
    setList(l);
    onCount(l.length);
    setText("");
  };
  const remove = async (c: NewsCommentView) => {
    if (!window.confirm("Retirer ce commentaire ?")) return;
    const r = await deleteNewsCommentAction(post.id, c.id);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok && list) {
      const l = list.filter((x) => x.id !== c.id);
      setList(l);
      onCount(l.length);
    }
  };
  const n = post.commentCount;
  if (!post.commentsEnabled && !n) return null;
  return (
    <div className="cm-comments">
      <button type="button" className="link" onClick={toggle} aria-expanded={open}>
        <Icon name="chat" />
        {n ? `${n} commentaire${n > 1 ? "s" : ""}` : "Commenter"}
      </button>
      {open && (
        <>
          {list === null ? (
            <span className="spin" />
          ) : (
            <ul className="cm-clist">
              {list.map((c) => (
                <li key={c.id}>
                  <Avatar name={c.authorName} founder={c.founder} />
                  <div>
                    <b>{c.authorName}</b>
                    <p>{c.body}</p>
                  </div>
                  {(c.authorId === meId || canModerate) && (
                    <button type="button" className="cm-flag" onClick={() => remove(c)}>
                      Retirer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {post.commentsEnabled && !readOnly ? (
            <form className="cm-cform" onSubmit={send}>
              <label className="sr" htmlFor={`c-${post.id}`}>
                Ton commentaire
              </label>
              <input id={`c-${post.id}`} value={text} maxLength={1000} placeholder="Écrire un commentaire…" onChange={(e) => setText(e.target.value)} />
              <button className="btn btn-ink btn-xs" disabled={busy || !text.trim()}>
                {busy ? <span className="spin" /> : "Envoyer"}
              </button>
            </form>
          ) : (
            !post.commentsEnabled && <p className="muted" style={{ fontSize: 13.5 }}>Les commentaires sont fermés.</p>
          )}
        </>
      )}
    </div>
  );
}

function Post({ post: initial, readOnly, meId, canModerate }: { post: NewsItem; readOnly?: boolean } & Viewer) {
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
        <Comments post={post} onCount={(n) => setPost((p) => ({ ...p, commentCount: n }))} readOnly={readOnly || post.status !== "published"} meId={meId} canModerate={canModerate} />
      </div>
    </article>
  );
}

/** Fil d'actualités du club : épinglées d'abord, réactions simples. */
export function NewsFeed({ posts, readOnly, meId, canModerate }: { posts: NewsItem[]; readOnly?: boolean } & Viewer) {
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
        <Post key={p.id} post={p} readOnly={readOnly} meId={meId} canModerate={canModerate} />
      ))}
    </div>
  );
}
