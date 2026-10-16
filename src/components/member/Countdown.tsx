"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const diff = Math.max(0, ms) / 1000;
  return { d: Math.floor(diff / 86400), h: Math.floor((diff % 86400) / 3600), m: Math.floor((diff % 3600) / 60), s: Math.floor(diff % 60) };
}
const pad = (n: number) => (n < 10 ? "0" : "") + n;

/** Compte à rebours jusqu'au prochain rendez-vous (horloge du serveur, qui suit la date de démo). */
export function Countdown({ target, serverNow, label }: { target: number; serverNow: number; label: string }) {
  const [left, setLeft] = useState(target - serverNow);
  useEffect(() => {
    const offset = serverNow - Date.now();
    const tick = () => setLeft(target - (Date.now() + offset));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, serverNow]);
  const p = parts(left);
  return (
    <div className="countdown" role="timer" aria-label={label}>
      <div>
        <b>{p.d}</b>
        <span>jours</span>
      </div>
      <div>
        <b>{pad(p.h)}</b>
        <span>heures</span>
      </div>
      <div>
        <b>{pad(p.m)}</b>
        <span>min</span>
      </div>
      <div>
        <b>{pad(p.s)}</b>
        <span>sec</span>
      </div>
    </div>
  );
}
