import type { CapacitorConfig } from "@capacitor/cli";

// L'app iPhone affiche le site en ligne : pas de copie du code dans l'app,
// chaque mise en ligne du site met aussi l'app à jour.
// Changer SITE_URL le jour où le vrai nom de domaine est branché.
const SITE_URL = "https://nomad-2-24-48-237.sslip.io";

const config: CapacitorConfig = {
  appId: "ma.nomadclub.app",
  appName: "Nomad Club",
  webDir: "mobile/www", // page de secours affichée sans connexion
  backgroundColor: "#0b0b0b",
  server: {
    url: `${SITE_URL}/espace`,
    cleartext: false,
    // Tout le site reste dans l'app (sinon seules les pages /espace… y restent
    // et la connexion s'ouvre dans Safari). Les autres sites (Stripe, liens
    // externes) continuent de s'ouvrir dans Safari.
    allowNavigation: [new URL(SITE_URL).host],
    errorPath: "index.html",
  },
  ios: {
    // Le site gère déjà les bords de l'écran (encoche, barre du bas).
    contentInset: "never",
    backgroundColor: "#0b0b0b",
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
