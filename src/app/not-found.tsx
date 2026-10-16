import Link from "next/link";

export default function NotFound() {
  return (
    <section className="space on" aria-label="Page introuvable">
      <div className="billet-page done">
        <img src="/img/monogramme-clair.png" alt="" style={{ height: 84, width: "auto", marginBottom: 20 }} />
        <div className="eyebrow">Page introuvable</div>
        <h1 className="sh-title" style={{ fontSize: 36 }}>
          Cette page n’existe pas, ou plus.
        </h1>
        <p className="sh-sub">Le lien a peut-être changé. Retrouve les prochains rendez-vous du club.</p>
        <Link className="btn btn-gold" href="/rendez-vous">
          Voir l’agenda
        </Link>
      </div>
    </section>
  );
}
