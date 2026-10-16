import QRCode from "qrcode";

export type QrData = { size: number; d: string };

/** Vrai QR code (scannable) dessiné en un seul chemin SVG, comme le billet de la maquette. */
export function qrData(text: string): QrData {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, d };
}
