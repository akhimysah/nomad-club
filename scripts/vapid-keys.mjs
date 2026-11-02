// Génère une paire de clés VAPID (notifications push Web) à copier dans .env.local / Vercel.
// Utilisation : node scripts/vapid-keys.mjs
import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
const d = ecdh.getPrivateKey();
console.log(`VAPID_PRIVATE_KEY=${Buffer.concat([Buffer.alloc(32 - d.length), d]).toString("base64url")}`);
console.log("VAPID_SUBJECT=mailto:bonjour@votre-domaine.ma");
