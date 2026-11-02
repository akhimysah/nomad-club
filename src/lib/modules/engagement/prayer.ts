/**
 * Heures de prière à Marrakech : API Aladhan (gratuite, sans clé), méthode 21 « Maroc »
 * (ministère des Habous : Fajr 19°, Isha 17°). Cache d'une journée (l'adresse contient la date).
 * Repli si l'API ne répond pas : calcul astronomique local avec les mêmes angles (approché à quelques minutes).
 */
import { TZ } from "../../clock";
import { MARRAKECH } from "./weather";

export const PRAYER_METHOD = 21;
export type PrayerName = "Fajr" | "Chourouk" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
export type PrayerTimes = { date: string; times: Array<{ name: PrayerName; label: string; time: string }>; source: "aladhan" | "calcul"; hijri: string | null };

const LABEL: Record<PrayerName, string> = { Fajr: "Fajr", Chourouk: "Chourouk", Dhuhr: "Dhuhr", Asr: "Asr", Maghrib: "Maghrib", Isha: "Icha" };
const ORDER: PrayerName[] = ["Fajr", "Chourouk", "Dhuhr", "Asr", "Maghrib", "Isha"];

type Aladhan = { code?: number; data?: { timings?: Record<string, string>; date?: { hijri?: { day?: string; year?: string; month?: { en?: string } } } } };

const HIJRI_FR: Record<string, string> = {
  Muḥarram: "Mouharram",
  Ṣafar: "Safar",
  "Rabīʿ al-awwal": "Rabia al-awal",
  "Rabīʿ al-thānī": "Rabia ath-thani",
  "Jumādá al-ūlá": "Joumada al-oula",
  "Jumādá al-ākhirah": "Joumada ath-thania",
  Rajab: "Rajab",
  Shaʿbān: "Chaabane",
  Ramaḍān: "Ramadan",
  Shawwāl: "Chawwal",
  "Dhū al-Qaʿdah": "Dhou al-qiida",
  "Dhū al-Ḥijjah": "Dhou al-hijja",
};

export async function getPrayerTimes(ymd: string): Promise<PrayerTimes> {
  const [y, m, d] = ymd.split("-");
  const url = `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${MARRAKECH.lat}&longitude=${MARRAKECH.lng}&method=${PRAYER_METHOD}&timezonestring=UTC`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Aladhan ${res.status}`);
    const j = (await res.json()) as Aladhan;
    const t = j.data?.timings;
    if (!t?.Fajr || !t.Isha) throw new Error("Aladhan : réponse inattendue");
    // Heures demandées en UTC puis converties avec le fuseau de l'appli (Aladhan applique d'anciennes règles pour le Maroc).
    const offset = Math.round(tzHours(ymd) * 60);
    const local = (v: string | undefined) => {
      const [hh, mm] = (v ?? "").slice(0, 5).split(":").map(Number);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
      const mins = fix(hh * 60 + mm + offset, 1440);
      return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    };
    const pick: Record<PrayerName, string> = { Fajr: local(t.Fajr), Chourouk: local(t.Sunrise), Dhuhr: local(t.Dhuhr), Asr: local(t.Asr), Maghrib: local(t.Maghrib), Isha: local(t.Isha) };
    const h = j.data?.date?.hijri;
    return {
      date: ymd,
      source: "aladhan",
      hijri: h?.day && h.year ? `${Number(h.day)} ${HIJRI_FR[h.month?.en ?? ""] ?? h.month?.en ?? ""} ${h.year}` : null,
      times: ORDER.map((name) => ({ name, label: LABEL[name], time: pick[name] })),
    };
  } catch (e) {
    console.warn("[prière]", e instanceof Error ? e.message : e);
    return computePrayerTimes(ymd);
  }
}

/* ---------- repli : calcul astronomique (algorithme classique de PrayTimes) ---------- */

const rad = (x: number) => (x * Math.PI) / 180;
const deg = (x: number) => (x * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
}

/** Décalage horaire de Marrakech (heures) ce jour-là. */
function tzHours(ymd: string): number {
  const noon = Date.parse(`${ymd}T12:00:00Z`);
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(noon);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 12);
  const mi = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h + mi / 60 - 12;
}

export function computePrayerTimes(ymd: string): PrayerTimes {
  const [y, m, d] = ymd.split("-").map(Number);
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const { decl, eqt } = sunPosition(jd);
  const lat = MARRAKECH.lat;
  const tz = tzHours(ymd);
  const dhuhr = 12 + tz - MARRAKECH.lng / 15 - eqt;
  const hourAngle = (angle: number) =>
    deg(Math.acos((-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat))))) / 15;
  const asrAngle = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(lat - decl))))));
  const hm = (h: number) => {
    const mins = Math.round(fix(h, 24) * 60);
    return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  };
  const values: Record<PrayerName, number> = {
    Fajr: dhuhr - hourAngle(19),
    Chourouk: dhuhr - hourAngle(0.833),
    Dhuhr: dhuhr + 5 / 60, // le Maroc ajoute quelques minutes de précaution
    Asr: dhuhr + hourAngle(asrAngle),
    Maghrib: dhuhr + hourAngle(0.833) + 5 / 60,
    Isha: dhuhr + hourAngle(17),
  };
  return { date: ymd, source: "calcul", hijri: null, times: ORDER.map((name) => ({ name, label: LABEL[name], time: hm(values[name]) })) };
}

/** Prochaine prière (heure locale HH:MM). */
export function nextPrayer(p: PrayerTimes, nowHm: string): PrayerName | null {
  return p.times.find((t) => t.name !== "Chourouk" && t.time > nowHm)?.name ?? null;
}
