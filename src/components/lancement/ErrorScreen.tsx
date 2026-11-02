import Image from "next/image";
import "@/styles/lancement.css";

/** Écran plein (erreur, maintenance, configuration manquante, statut) au design de la marque. */
export function ErrorScreen({ code, title, children, label }: { code: string; title: string; children: React.ReactNode; label?: string }) {
  return (
    <section className="lc-error" aria-label={label ?? title}>
      <div className="lc-error-in">
        <Image src="/img/monogramme-clair.png" alt="Nomad Club" width={54} height={84} priority />
        <div className="lc-error-code">{code}</div>
        <h1 className="sh-title">{title}</h1>
        {children}
      </div>
    </section>
  );
}
