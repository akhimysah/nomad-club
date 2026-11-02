"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deleteNewsAction, pinNewsAction, saveNewsAction, setNewsStatusAction } from "@/app/actions/communaute";
import { CLUB_PHOTOS } from "@/lib/modules/communaute/domain";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";
import type { NewsItem } from "./NewsFeed";

/** Réduit une image importée à 1600 px (JPEG) pour rester sous la limite. */
async function shrink(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Draft = { id?: string; title: string; body: string; image: string | null; pinned: boolean; commentsEnabled: boolean; published: boolean };

/** Lot 1 — Créer ou modifier une publication : texte, photo du club ou image importée, épinglage. */
export function NewsEditor({ initial }: { initial: Draft }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast("Choisis une image JPEG ou PNG.", "bell");
    setF({ ...f, image: await shrink(file) });
  };
  const save = async (publish: boolean) => {
    setBusy(publish ? "publish" : "draft");
    const r = await saveNewsAction({ title: f.title, body: f.body, image: f.image, pinned: f.pinned, commentsEnabled: f.commentsEnabled }, { id: f.id, publish });
    setBusy(null);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) {
      router.push("/fondatrices/communaute/actualites");
      router.refresh();
    }
  };
  return (
    <form
      className="cm-form card"
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
    >
      <div className="field">
        <label htmlFor="n-title">Titre</label>
        <input id="n-title" required maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="n-body">Texte</label>
        <textarea id="n-body" required maxLength={10000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </div>
      <div className="mini-h">Photo</div>
      {f.image && !CLUB_PHOTOS.some((p) => p.src === f.image) && (
        <div className="cm-preview">
          <img src={f.image} alt="Image importée" />
        </div>
      )}
      <div className="cm-photos">
        <button type="button" className={"none" + (!f.image ? " on" : "")} onClick={() => setF({ ...f, image: null })}>
          Sans photo
        </button>
        {CLUB_PHOTOS.map((p) => (
          <button key={p.src} type="button" className={f.image === p.src ? "on" : undefined} aria-label={p.label} aria-pressed={f.image === p.src} onClick={() => setF({ ...f, image: p.src })}>
            <img src={p.src} alt="" />
          </button>
        ))}
        <button type="button" className="none" onClick={() => fileRef.current?.click()}>
          Importer…
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
      </div>
      <label className="toggle">
        Épingler en haut du fil
        <input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />
      </label>
      <label className="toggle">
        Autoriser les commentaires des membres
        <input type="checkbox" checked={f.commentsEnabled} onChange={(e) => setF({ ...f, commentsEnabled: e.target.checked })} />
      </label>
      <div className="btn-row">
        <button type="submit" className="btn btn-gold" disabled={!!busy}>
          {busy === "publish" ? <span className="spin" /> : <Icon name="send" />}
          {f.published ? "Enregistrer" : "Publier"}
        </button>
        {!f.published && (
          <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => save(false)}>
            {busy === "draft" && <span className="spin" />}
            Enregistrer le brouillon
          </button>
        )}
        <Link className="btn btn-ghost" href="/fondatrices/communaute/actualites">
          Annuler
        </Link>
      </div>
      {!f.published && <p className="fine">À la publication, chaque membre reçoit une notification.</p>}
    </form>
  );
}

/** Liste des publications (brouillons compris) avec publier, épingler, supprimer. */
export function NewsAdminList({ posts }: { posts: NewsItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    toast(r.ok ? r.message : r.error, r.ok ? "check" : "bell");
    if (r.ok) router.refresh();
  };
  if (!posts.length)
    return (
      <div className="empty">
        <Icon name="star" />
        Pas encore de publication.
      </div>
    );
  return (
    <section className="card">
      {posts.map((p) => {
        const total = p.reactions.like + p.reactions.bravo + p.reactions.merci;
        return (
          <div key={p.id} className="cm-row">
            <span style={{ minWidth: 0 }}>
              <b>
                {p.pinned && <Icon name="star" />} {p.title}
              </b>
              <span className="sub">
                {p.status === "draft" ? "Brouillon" : "Publié"} · {p.dateLabel} · {p.authorName}
                {p.status === "published" ? ` · ${total} réaction${total > 1 ? "s" : ""}` : ""}
                {p.commentsEnabled || p.commentCount ? ` · ${p.commentCount} commentaire${p.commentCount > 1 ? "s" : ""}${p.commentsEnabled ? "" : " (fermés)"}` : ""}
              </span>
            </span>
            <span className="cm-acts">
              <Link className="btn btn-ghost btn-xs" href={`/fondatrices/communaute/actualites/${p.id}`}>
                Modifier
              </Link>
              <button type="button" className="btn btn-ghost btn-xs" disabled={!!busy} onClick={() => run(p.id + "pin", () => pinNewsAction(p.id, !p.pinned))}>
                {p.pinned ? "Désépingler" : "Épingler"}
              </button>
              <button
                type="button"
                className={p.status === "draft" ? "btn btn-ink btn-xs" : "btn btn-ghost btn-xs"}
                disabled={!!busy}
                onClick={() => run(p.id + "st", () => setNewsStatusAction(p.id, p.status === "draft" ? "published" : "draft"))}
              >
                {busy === p.id + "st" && <span className="spin" />}
                {p.status === "draft" ? "Publier" : "Dépublier"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                disabled={!!busy}
                onClick={() => window.confirm(`Supprimer « ${p.title} » ?`) && run(p.id + "del", () => deleteNewsAction(p.id))}
              >
                Supprimer
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}
