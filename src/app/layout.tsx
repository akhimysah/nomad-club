import type { Metadata, Viewport } from "next";
import { Albert_Sans, Playfair_Display } from "next/font/google";
import { CheckoutHost } from "@/components/events/CheckoutHost";
import { IconSprite } from "@/components/IconSprite";
import { PwaRegister } from "@/components/securite/PwaRegister";
import { Switcher } from "@/components/shell/Switcher";
import { FlyCatcher } from "@/components/ui/fly";
import { ToastProvider } from "@/components/ui/Toasts";
import { nowMs } from "@/lib/clock";
import { isRealMode } from "@/lib/env";
import { todayLong } from "@/lib/format";
import "./globals.css";

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

export const metadata: Metadata = {
  title: { default: "Nomad Club", template: "%s · Nomad Club" },
  description: "Club de femmes et d’entrepreneuses à Marrakech, fondé par Julia et Nora. Rendez-vous, carnet d’adresses et cercle de membres.",
  applicationName: "Nomad Club",
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
  return (
    <html lang="fr" className={`${playfair.variable} ${albert.variable}${real ? " no-switch" : ""}`}>
      <body>
        <IconSprite />
        <ToastProvider>
          <CheckoutHost>
            <FlyCatcher />
            {!real && <Switcher dateLabel={todayLong(nowMs())} />}
            <main id="spaces">{children}</main>
          </CheckoutHost>
        </ToastProvider>
        <PwaRegister /> {/* --- Lot 6 --- */}
      </body>
    </html>
  );
}
