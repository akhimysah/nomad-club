"use client";

import { useEffect, useState, useTransition } from "react";
import { deletePushSubscriptionAction, savePushSubscriptionAction, testPushAction } from "@/app/actions/securite";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toasts";

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "loading" | "unsupported" | "ios-browser" | "denied" | "off" | "on";

/** Lot 6 — notifications push sur cet appareil (abonnement Web Push ; clés VAPID côté serveur). */
export function PushToggle({ vapidKey, demo }: { vapidKey: string | null; demo: boolean }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      let s: Status;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) s = ios && !standalone ? "ios-browser" : "unsupported";
      else if (Notification.permission === "denied") s = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        s = (await reg?.pushManager.getSubscription()) ? "on" : "off";
      }
      if (alive) setStatus(s);
    })().catch(() => alive && setStatus("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  if (!vapidKey)
    return (
      <p className="muted sec-note">
        <Icon name="bell" />
        {demo ? "En démo, les notifications push sont désactivées." : "Les notifications push seront disponibles quand le club aura configuré ses clés d’envoi."}
      </p>
    );

  const subscribe = () =>
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStatus(perm === "denied" ? "denied" : "off");
          return;
        }
        const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) });
        const json = sub.toJSON();
        const r = await savePushSubscriptionAction({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent.slice(0, 300) });
        toast(r.ok ? r.message : r.error, r.ok ? "bell" : "lock");
        if (r.ok) setStatus("on");
      } catch {
        toast("Activation impossible sur cet appareil.", "lock");
      }
    });

  const unsubscribe = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      toast("Notifications coupées sur cet appareil.", "bell");
    });

  return (
    <div className="sec-push">
      {status === "ios-browser" && <p className="muted">Sur iPhone, ajoute d’abord l’appli à ton écran d’accueil (voir ci-dessous), puis ouvre-la depuis son icône.</p>}
      {status === "unsupported" && <p className="muted">Ce navigateur ne gère pas les notifications push.</p>}
      {status === "denied" && <p className="muted">Les notifications sont bloquées pour ce site : autorise-les dans les réglages du navigateur.</p>}
      {(status === "off" || status === "on") && (
        <div className="btn-row">
          {status === "off" ? (
            <button type="button" className="btn btn-ink btn-sm" onClick={subscribe} aria-busy={busy} disabled={busy}>
              <Icon name="bell" />
              Activer sur cet appareil
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={unsubscribe} aria-busy={busy} disabled={busy}>
                Couper sur cet appareil
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const r = await testPushAction();
                    toast(r.ok ? r.message : r.error, r.ok ? "bell" : "lock");
                  })
                }
              >
                Envoyer un essai
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
