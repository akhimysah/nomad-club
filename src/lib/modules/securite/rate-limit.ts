/**
 * Lot 6 — limitation de fréquence des actions publiques sensibles.
 *
 * Fenêtre fixe par clé (« magic:ip:1.2.3.4 »). Deux magasins interchangeables :
 * - mémoire du processus (démo, ou mode réel sans clé service) : simple, mais propre à chaque instance ;
 * - Postgres (mode réel avec SUPABASE_SERVICE_ROLE_KEY) : fonction rate_limit_hit() de 0008_securite.sql,
 *   partagée entre toutes les instances (Vercel).
 * Pour un autre magasin (Upstash Redis, en-tête d'un pare-feu…), implémenter `RateLimitStore` et appeler setRateLimitStore().
 * Un magasin en panne laisse passer (on ne bloque pas le club pour un compteur).
 */
import { isRealMode } from "../../env";
import { clientIp } from "./request";

export type RateLimitRule = { limit: number; windowSec: number; message: string };
export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfter: number; message: string };

/** Règles par action. Les messages sont affichés tels quels. */
export const RATE_LIMITS = {
  /** Réservation (surtout sans compte) : par adresse IP. */
  booking: { limit: 12, windowSec: 10 * 60, message: "Beaucoup de réservations d’un coup. Réessaie dans quelques minutes." },
  /** Lien magique : par adresse IP… */
  magicLinkIp: { limit: 6, windowSec: 15 * 60, message: "Trop de demandes de lien de connexion. Réessaie dans un quart d’heure." },
  /** …et par adresse e-mail (évite d'inonder une boîte). */
  magicLinkEmail: { limit: 3, windowSec: 15 * 60, message: "Un lien vient déjà de partir vers cette adresse. Regarde ta boîte (et les indésirables), ou réessaie dans un quart d’heure." },
  /** Connexion par mot de passe : par adresse IP et par compte (essais en rafale). */
  passwordIp: { limit: 20, windowSec: 15 * 60, message: "Trop d’essais de connexion. Réessaie dans un quart d’heure." },
  passwordEmail: { limit: 8, windowSec: 15 * 60, message: "Trop d’essais pour cette adresse. Réessaie dans un quart d’heure, ou reçois un lien de connexion." },
  /** Mot de passe oublié : par adresse e-mail. */
  passwordReset: { limit: 3, windowSec: 60 * 60, message: "Un lien vient déjà de partir vers cette adresse. Regarde ta boîte (et les indésirables), ou réessaie dans une heure." },
  /** Messages au salon et privés : par personne. */
  message: { limit: 20, windowSec: 60, message: "Tu envoies beaucoup de messages d’affilée. Patiente une minute." },
  /** Signalements (Lot 1) : par personne. */
  report: { limit: 10, windowSec: 60 * 60, message: "Tu as déjà fait beaucoup de signalements. Les modératrices les examinent ; réessaie plus tard." },
  /** Paiement en ligne (création de session Stripe) : par adresse IP. */
  checkout: { limit: 10, windowSec: 10 * 60, message: "Trop de tentatives de paiement. Réessaie dans quelques minutes." },
  /** Consultation d'un billet par son code : par adresse IP (contre l'énumération des codes). */
  ticketLookup: { limit: 30, windowSec: 10 * 60, message: "Trop de billets consultés. Réessaie dans quelques minutes." },
  /** Assistant du club : par adresse IP. */
  assistant: { limit: 30, windowSec: 5 * 60, message: "L’assistant a besoin d’une petite pause. Réessaie dans quelques minutes." },
  /** Export RGPD : par personne. */
  dataExport: { limit: 5, windowSec: 60 * 60, message: "Tu as déjà téléchargé tes données plusieurs fois. Réessaie dans une heure." },
  /** Demande / annulation de suppression, consentements : par personne. */
  account: { limit: 30, windowSec: 10 * 60, message: "Trop de modifications d’affilée. Réessaie dans quelques minutes." },
  /** Code de double authentification : par personne. */
  mfa: { limit: 8, windowSec: 10 * 60, message: "Trop de codes essayés. Patiente dix minutes avant de recommencer." },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export interface RateLimitStore {
  hit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number; retryAfter: number }>;
}

/* ---------- magasin mémoire ---------- */
type Bucket = { start: number; hits: number };
type G = typeof globalThis & { __nomadRateLimits?: Map<string, Bucket> };

export const memoryStore: RateLimitStore = {
  async hit(key, limit, windowSec) {
    const g = globalThis as G;
    const map = (g.__nomadRateLimits ??= new Map());
    const now = Date.now();
    const win = windowSec * 1000;
    const start = Math.floor(now / win) * win;
    let b = map.get(key);
    if (!b || b.start !== start) {
      b = { start, hits: 0 };
      map.set(key, b);
    }
    b.hits++;
    if (map.size > 20000) {
      for (const [k, v] of map) if (v.start + win < now) map.delete(k);
    }
    return { ok: b.hits <= limit, remaining: Math.max(0, limit - b.hits), retryAfter: Math.ceil((start + win - now) / 1000) };
  },
};

/* ---------- magasin Postgres (Supabase, clé service) ---------- */
export const postgresStore: RateLimitStore = {
  async hit(key, limit, windowSec) {
    const { supabaseAdmin } = await import("../../supabase/server");
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSec });
    if (error) throw new Error(error.message);
    const r = data as { ok: boolean; remaining: number; retry_after: number };
    return { ok: r.ok, remaining: r.remaining, retryAfter: r.retry_after };
  },
};

let customStore: RateLimitStore | null = null;

/** Remplace le magasin (tests, Redis…). */
export function setRateLimitStore(store: RateLimitStore | null): void {
  customStore = store;
}

function store(): RateLimitStore {
  if (customStore) return customStore;
  if (process.env.RATE_LIMIT_STORE === "memory") return memoryStore;
  return isRealMode() && process.env.SUPABASE_SERVICE_ROLE_KEY ? postgresStore : memoryStore;
}

/** Désactivable pour des tests de charge : RATE_LIMIT_DISABLED=1. */
const disabled = () => process.env.RATE_LIMIT_DISABLED === "1";

/**
 * Compte un appel. `subject` identifie qui (« ip:… », « user:… », « email:… ») ;
 * par défaut l'adresse IP de la requête.
 */
export async function rateLimit(name: RateLimitName, subject?: string): Promise<RateLimitResult> {
  if (disabled()) return { ok: true, remaining: Infinity };
  const rule: RateLimitRule = RATE_LIMITS[name];
  const who = subject ?? `ip:${await clientIp()}`;
  try {
    const r = await store().hit(`${name}:${who}`.slice(0, 200), rule.limit, rule.windowSec);
    return r.ok ? { ok: true, remaining: r.remaining } : { ok: false, retryAfter: r.retryAfter, message: rule.message };
  } catch (e) {
    console.error("[rate-limit]", name, e instanceof Error ? e.message : e);
    return { ok: true, remaining: 0 };
  }
}

/** Raccourci : renvoie le message d'erreur si la limite est atteinte, sinon null. */
export async function rateLimitMessage(name: RateLimitName, subject?: string): Promise<string | null> {
  const r = await rateLimit(name, subject);
  return r.ok ? null : r.message;
}
