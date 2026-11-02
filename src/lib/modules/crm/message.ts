/**
 * Messages préparés (aucun envoi automatique) : texte personnalisé et lien WhatsApp prérempli.
 * Sans dépendance : utilisable dans les composants client.
 */

export function fillTemplate(text: string, r: { name: string; firstName?: string | null }): string {
  const prenom = r.firstName || r.name.split(" ")[0] || "";
  return text.replace(/\{prenom\}/gi, prenom).replace(/\{nom\}/gi, r.name);
}

/** Lien WhatsApp (wa.me) avec le message prérempli ; null sans numéro exploitable. */
export function whatsappLink(phone: string | null, text: string): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 10) d = "212" + d.slice(1); // numéro marocain local
  if (d.length < 8) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
