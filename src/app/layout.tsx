import type { Metadata, Viewport } from "next";
import { Albert_Sans, Playfair_Display } from "next/font/google";
import { CheckoutHost } from "@/components/events/CheckoutHost";
import { IconSprite } from "@/components/IconSprite";
import { PwaRegister } from "@/components/securite/PwaRegister";
import { Switcher } from "@/components/shell/Switcher";
import { FlyCatcher } from "@/components/ui/fly";
import { ToastProvider } from "@/components/ui/Toasts";
import { nowMs } from "@/lib/clock";
import { demoAllowed, isRealMode } from "@/lib/env";
import { publicSiteUrl } from "@/lib/modules/lancement/seo"; // --- Lancement ---
import { todayLong } from "@/lib/format";
import "./globals.css";
import "../styles/communaute.css"; // --- Lot 1 ---

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const albert = Albert_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-albert",
  display: "swap",
});

const DESCRIPTION = "Club de femmes et d’entrepreneuses à Marrakech, fondé par Julia et Nora. Rendez-vous, carnet d’adresses et cercle de membres.";

export const metadata: Metadata = {
  // --- Lancement --- adresse publique, partage social (image générée : opengraph-image.tsx), indexation
  metadataBase: new URL(publicSiteUrl()),
  title: { default: "Nomad Club · Marrakech", template: "%s · Nomad Club" },
  description: DESCRIPTION,
  applicationName: "Nomad Club",
  openGraph: { type: "website", locale: "fr_FR", siteName: "Nomad Club", title: "Nomad Club · le club des femmes entrepreneuses à Marrakech", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Nomad Club · Marrakech", description: DESCRIPTION },
  robots: isRealMode() ? { index: true, follow: true } : { index: false, follow: false },
  appleWebApp: { capable: true, title: "Nomad Club", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const real = isRealMode();
  const showSwitcher = !real && demoAllowed(); // --- Lancement --- jamais de sélecteur démo si NEXT_PUBLIC_DEMO=false
  return (
    <html lang="fr" className={`${playfair.variable} ${albert.variable}${showSwitcher ? "" : " no-switch"}`}>
      <body>
        <IconSprite />
        <ToastProvider>
          <CheckoutHost>
            <FlyCatcher />
            {showSwitcher && <Switcher dateLabel={todayLong(nowMs())} />}
            <main id="spaces">{children}</main>
          </CheckoutHost>
        </ToastProvider>
        <PwaRegister /> {/* --- Lot 6 --- */}
      </body>
    </html>
  );
}
