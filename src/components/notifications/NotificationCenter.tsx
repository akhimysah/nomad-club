"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { markNotificationsReadAction, setNotificationPrefAction } from "@/app/actions/notifications";
import type { NotificationItem, PrefItem } from "@/lib/notifications-view";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

/** Liste des notifications (clic = lue + ouverture du lien) et réglages par type. */
export function NotificationCenter({ items, prefs }: { items: NotificationItem[]; prefs: PrefItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [shown, setRead] = useOptimistic(items, (cur, ids: string[] | "all") => cur.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, unread: false } : n)));
  const [prefsShown, setPref] = useOptimistic(prefs, (cur, p: { type: PrefItem["type"]; key: "inApp" | "email"; value: boolean }) =>
    cur.map((x) => (x.type === p.type ? { ...x, [p.key]: p.value } : x)),
  );
  const unread = shown.filter((n) => n.unread).length;

  const open = (n: NotificationItem) =>
    start(async () => {
      if (n.unread) {
        setRead([n.id]);
        await markNotificationsReadAction([n.id]);
      }
      if (n.link) router.push(n.link);
    });

  return (
    <>
      <section className="card" aria-labelledby="notif-h">
        <div className="card-h">
          <h2 id="notif-h">{unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}</h2>
          {unread > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-busy={pending}
              onClick={() =>
                start(async () => {
                  setRead("all");
                  await markNotificationsReadAction("all");
                  toast("Notifications marquées comme lues", "check");
                })
              }
            >
              <Icon name="check" />
              Tout marquer comme lu
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <div className="empty">
            <Icon name="bell" />
            Aucune notification pour l’instant.
          </div>
        ) : (
          <ul className="notif-list">
            {shown.map((n) => (
              <li key={n.id} className={"notif" + (n.unread ? " unread" : "")}>
                <button type="button" className="notif-btn" onClick={() => open(n)}>
                  <span className="n-ic">
                    <Icon name={n.icon} />
                  </span>
                  <span>
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                  </span>
                  <time>{n.time}</time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="pref-h" style={{ marginTop: 22 }}>
        <div className="card-h">
          <h2 id="pref-h">Préférences</h2>
          <span className="muted">L’envoi par e-mail et sur le téléphone arrive bientôt.</span>
        </div>
        <div className="pref-row head">
          <span>Type</span>
          <span>Dans l’appli</span>
          <span>E-mail</span>
        </div>
        {prefsShown.map((p) => (
          <div key={p.type} className="pref-row">
            <span>
              <b>{p.label}</b>
              <span>{p.hint}</span>
            </span>
            {(["inApp", "email"] as const).map((key) => (
              <input
                key={key}
                type="checkbox"
                className="pref-switch"
                aria-label={`${p.label} : ${key === "inApp" ? "dans l’appli" : "par e-mail"}`}
                checked={p[key]}
                onChange={(e) => {
                  const value = e.target.checked;
                  start(async () => {
                    setPref({ type: p.type, key, value });
                    const r = await setNotificationPrefAction(p.type, key, value);
                    if (!r.ok) toast("Réglage impossible.", "bell");
                  });
                }}
              />
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
