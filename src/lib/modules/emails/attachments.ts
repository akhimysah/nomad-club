/**
 * Pièces jointes générées à partir des données d'un modèle (serveur) : QR code du billet en image intégrée,
 * rendez-vous au format .ics. Régénérées à chaque envoi (et pour « Renvoyer »), jamais stockées.
 */
import QRCode from "qrcode";
import { eventIcs } from "../communaute/domain";
import { TICKET_QR_CID } from "./templates";
import type { OutgoingAttachment, TemplateId } from "./types";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function ticketQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", errorCorrectionLevel: "M", margin: 1, width: 336, color: { dark: "#111111", light: "#ffffff" } });
}

export async function generatedAttachments(template: TemplateId, data: Record<string, unknown>, baseUrl: string): Promise<OutgoingAttachment[]> {
  const out: OutgoingAttachment[] = [];
  if (template !== "booking_confirmed") return out;
  const code = str(data.ticketCode);
  if (code) {
    const png = await ticketQrPng(`${baseUrl}/billet/${encodeURIComponent(code)}`);
    out.push({ filename: "billet-qr.png", contentBase64: png.toString("base64"), contentType: "image/png", contentId: TICKET_QR_CID });
  }
  const startsAt = str(data.startsAt);
  if (startsAt && !Number.isNaN(Date.parse(startsAt))) {
    const slug = str(data.eventSlug) || "rendez-vous";
    const ics = eventIcs(
      {
        id: str(data.eventId) || slug,
        slug,
        title: str(data.eventTitle) || "Rendez-vous du Nomad Club",
        startsAt,
        endsAt: str(data.endsAt) || null,
        venue: str(data.venue) || null,
        address: str(data.address) || null,
        description: str(data.description) || `Ton billet : ${code}`,
      },
      `${baseUrl}${str(data.eventUrl) || `/rendez-vous/${slug}`}`,
      new Date().toISOString(),
    );
    out.push({ filename: `${slug}.ics`, contentBase64: Buffer.from(ics, "utf8").toString("base64"), contentType: "text/calendar; charset=utf-8; method=PUBLISH" });
  }
  return out;
}
