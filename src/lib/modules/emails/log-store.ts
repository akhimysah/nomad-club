/**
 * Journal des envois : table `email_log` en mode réel (écriture par la clé service, lecture par les
 * administratrices sous RLS), mémoire en démo (avec quelques envois d'exemple).
 */
import { randomUUID } from "node:crypto";
import { isRealMode } from "../../env";
import { TEMPLATES } from "./templates";
import type { EmailLogEntry, EmailLogFilters, EmailLogInput } from "./types";

export interface EmailLogStore {
  insert(entry: EmailLogInput): Promise<EmailLogEntry | null>;
  list(filters?: EmailLogFilters): Promise<EmailLogEntry[]>;
  get(id: string): Promise<EmailLogEntry | null>;
  /** Un envoi réussi de ce modèle existe-t-il déjà pour cette personne (et cette clé de données) ? */
  hasSent(template: string, profileId: string, dataKey?: { key: string; value: string }): Promise<boolean>;
}

/* ---------------------------- démo ---------------------------- */

const MEM = Symbol.for("nomad-club.emails.log");

function memory(): EmailLogEntry[] {
  const g = globalThis as unknown as Record<symbol, EmailLogEntry[] | undefined>;
  if (!g[MEM]) {
    const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
    const ex = (template: keyof typeof TEMPLATES, to: string, profileId: string | null, h: number, status: "sent" | "failed" = "sent", error: string | null = null): EmailLogEntry => ({
      id: randomUUID(),
      profileId,
      toEmail: to,
      template,
      subject: TEMPLATES[template].label,
      status,
      provider: "console",
      providerId: status === "sent" ? `console-exemple-${h}` : null,
      error,
      data: TEMPLATES[template].sample,
      attachments: template === "booking_confirmed" ? ["billet-qr.png", "rendez-vous.ics"] : [],
      resentFrom: null,
      createdBy: null,
      createdAt: ago(h),
    });
    g[MEM] = [
      ex("payment_failed", "lou.garnier@example.com", null, 30, "failed", "Exemple : adresse refusée par le serveur de réception."),
      ex("welcome", "ines@example.com", null, 26),
      ex("booking_confirmed", "ines@example.com", null, 5),
      ex("payment_receipt", "lou.garnier@example.com", null, 2),
    ];
  }
  return g[MEM]!;
}

function matches(e: EmailLogEntry, f: EmailLogFilters): boolean {
  if (f.template && e.template !== f.template) return false;
  if (f.status && e.status !== f.status) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!`${e.toEmail} ${e.subject}`.toLowerCase().includes(q)) return false;
  }
  return true;
}

const demoStore: EmailLogStore = {
  async insert(entry) {
    const row: EmailLogEntry = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
    const m = memory();
    m.push(row);
    if (m.length > 500) m.splice(0, m.length - 500);
    return row;
  },
  async list(f = {}) {
    return memory()
      .filter((e) => matches(e, f))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, f.limit ?? 200);
  },
  async get(id) {
    return memory().find((e) => e.id === id) ?? null;
  },
  async hasSent(template, profileId, dataKey) {
    return memory().some((e) => e.template === template && e.profileId === profileId && e.status === "sent" && (!dataKey || String(e.data[dataKey.key] ?? "") === dataKey.value));
  },
};

/* ---------------------------- Supabase ---------------------------- */

type Row = {
  id: string;
  profile_id: string | null;
  to_email: string;
  template: string;
  subject: string;
  status: "sent" | "failed";
  provider: string;
  provider_id: string | null;
  error: string | null;
  data: Record<string, unknown> | null;
  attachments: string[] | null;
  resent_from: string | null;
  created_by: string | null;
  created_at: string;
};

const fromRow = (r: Row): EmailLogEntry => ({
  id: r.id,
  profileId: r.profile_id,
  toEmail: r.to_email,
  template: r.template,
  subject: r.subject,
  status: r.status,
  provider: r.provider,
  providerId: r.provider_id,
  error: r.error,
  data: r.data ?? {},
  attachments: r.attachments ?? [],
  resentFrom: r.resent_from,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

let warned = false;

async function admin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!warned) console.warn("[e-mails] SUPABASE_SERVICE_ROLE_KEY absente : le journal des envois n’est pas enregistré.");
    warned = true;
    return null;
  }
  const { supabaseAdmin } = await import("../../supabase/server");
  return supabaseAdmin();
}

const COLS = "id, profile_id, to_email, template, subject, status, provider, provider_id, error, data, attachments, resent_from, created_by, created_at";

const supabaseStore: EmailLogStore = {
  async insert(e) {
    const c = await admin();
    if (!c) return null;
    const { data, error } = await c
      .from("email_log")
      .insert({
        profile_id: e.profileId,
        to_email: e.toEmail,
        template: e.template,
        subject: e.subject.slice(0, 300),
        status: e.status,
        provider: e.provider,
        provider_id: e.providerId,
        error: e.error ? e.error.slice(0, 1000) : null,
        data: e.data,
        attachments: e.attachments,
        resent_from: e.resentFrom,
        created_by: e.createdBy,
      })
      .select(COLS)
      .single();
    if (error) {
      console.error("[e-mails] journal :", error.message);
      return null;
    }
    return fromRow(data as Row);
  },
  async list(f = {}) {
    const { supabaseServer } = await import("../../supabase/server");
    const c = await supabaseServer();
    let q = c.from("email_log").select(COLS).order("created_at", { ascending: false }).limit(f.limit ?? 200);
    if (f.template) q = q.eq("template", f.template);
    if (f.status) q = q.eq("status", f.status);
    if (f.q) {
      const like = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
      q = q.or(`to_email.ilike.${like},subject.ilike.${like}`);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(fromRow);
  },
  async get(id) {
    const { supabaseServer } = await import("../../supabase/server");
    const c = await supabaseServer();
    const { data } = await c.from("email_log").select(COLS).eq("id", id).maybeSingle();
    return data ? fromRow(data as Row) : null;
  },
  async hasSent(template, profileId, dataKey) {
    const c = await admin();
    if (!c) return false;
    let q = c.from("email_log").select("id").eq("template", template).eq("profile_id", profileId).eq("status", "sent").limit(1);
    if (dataKey) q = q.eq(`data->>${dataKey.key}`, dataKey.value);
    const { data } = await q;
    return Boolean(data?.length);
  },
};

export function emailLogStore(): EmailLogStore {
  return isRealMode() ? supabaseStore : demoStore;
}
