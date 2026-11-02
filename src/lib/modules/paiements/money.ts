/**
 * Devise et affichage des montants : UNE seule fonction, `formatMoney()`, utilisée partout
 * (`money()` de src/lib/format.ts y délègue). Module pur, importable côté navigateur et par les tests Node.
 *
 * Devise : NEXT_PUBLIC_CURRENCY (code ISO 4217, défaut USD). Changer de devise ne convertit rien :
 * les montants enregistrés sont exprimés dans la devise configurée.
 */

const NBSP = " ";

/** Symbole affiché après le montant, à la française (« 1 250 $ », « 1 250 € », « 1 250 DH »). */
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", MAD: "DH", GBP: "£", CHF: "CHF", CAD: "$" + NBSP + "CA" };

export function currency(): string {
  const c = (process.env.NEXT_PUBLIC_CURRENCY || "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : "USD";
}

export function currencySymbol(code: string = currency()): string {
  return SYMBOL[code] ?? code;
}

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/**
 * 1250 → « 1 250 $ » ; 223.335 → « 223,34 $ » ; -20 → « −20 $ ».
 * Les centimes ne s'affichent que s'il y en a (ou si `cents: true`).
 */
export function formatMoney(amount: number, opts: { currency?: string; cents?: boolean } = {}): string {
  const code = opts.currency ?? currency();
  const minor = Math.round(Math.abs(Number.isFinite(amount) ? amount : 0) * 100);
  const units = Math.floor(minor / 100);
  const rest = minor % 100;
  const showCents = opts.cents || rest !== 0;
  const body = group(String(units)) + (showCents ? "," + String(rest).padStart(2, "0") : "");
  return (amount < 0 && minor ? "−" : "") + body + NBSP + currencySymbol(code);
}

/** Unités → centimes (Stripe, CMI). */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

/** Centimes → unités. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/** Arrondi au centime. */
export function round2(amount: number): number {
  return Math.round(amount * 100) / 100;
}
