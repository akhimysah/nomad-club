import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarnetTabs } from "@/components/partenaires/CarnetTabs";
import { MiniMap } from "@/components/partenaires/MiniMap";
import { UseOfferButton } from "@/components/partenaires/UseOfferButton";
import { EventImage, NoImage } from "@/components/ui/EventImage";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { requireCapability } from "@/lib/auth";
import { today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { ymdLong } from "@/lib/format";
import { AUDIENCE_LABEL, CATEGORY_LABEL, offerAvailability } from "@/lib/modules/partenaires/domain";
import { visibleEstablishments } from "@/lib/modules/partenaires/server";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = await getRepo().getEstablishment(slug);
  return { title: e?.name ?? "Fiche" };
}

/** Fiche établissement côté membre : photos, infos, contacts (comptés), position, offres et « Utiliser l'offre ». */
export default async function FichePage({ params }: Props) {
  const { slug } = await params;
  const v = await requireCapability("carnet.view", { next: `/espace/fiche/${slug}`, fallback: "/formules" });
  const e = (await visibleEstablishments()).find((x) => x.slug === slug);
  if (!e) notFound();
  const repo = getRepo();
  const [offers] = await Promise.all([e.kinds.includes("partner") ? repo.listOffers({ organizationId: e.id, activeOnly: true }) : Promise.resolve([]), repo.trackOrgEvent(e.id, "view", v.profile.id)]);
  const t = today();
  const go = (to: string) => `/espace/fiche/${e.slug}/aller?vers=${to}`;
  const d = e.details;
  const photos = d.photos;
  return (
    <Screen group="member" index={3} className="mscreen scroller on">
      <div className="m-inner">
        <CarnetTabs current={e.kinds.includes("partner") ? "offres" : "carnet"} />
        <div className="est-gallery">
          {photos.length ? (
            photos.map((p, i) => (
              <div key={p + i} className="ph">
                <EventImage image={p} alt={`${e.name}, photo ${i + 1}`} priority={i === 0} />
              </div>
            ))
          ) : (
            <div className="ph noimg">
              <NoImage label={e.name} />
            </div>
          )}
        </div>
        <div className="est-grid">
          <div className="est-col">
            <section className="card">
              <div className="eyebrow">{e.category}</div>
              <h1 className="scr-title" style={{ marginTop: 6 }}>
                {e.name}
              </h1>
              <div className="est-head">
                {e.kinds.includes("partner") && <span className="chip solid">Partenaire du club</span>}
                {e.listed && (
                  <span className="pro-badge">
                    <Icon name="star" />
                    Pro du réseau
                  </span>
                )}
                {d.carnetCategory && <span className="chip">{CATEGORY_LABEL[d.carnetCategory]}</span>}
                {e.area && (
                  <span className="chip">
                    <Icon name="pin" />
                    {e.area}
                  </span>
                )}
              </div>
              {e.description && <p className="lead" style={{ marginBottom: 0 }}>{e.description}</p>}
              {d.memberDiscount && e.listed && (
                <div className="pro-discount">
                  <Icon name="gift" />
                  <span>
                    <b>Pour les membres :</b> {d.memberDiscount}
                  </span>
                </div>
              )}
              <ul className="est-info">
                {e.address && (
                  <li>
                    <Icon name="pin" />
                    <span>
                      {e.address}
                      {e.area ? `, ${e.area}` : ""}
                    </span>
                  </li>
                )}
                {d.hours && (
                  <li>
                    <Icon name="clock" />
                    <span>{d.hours}</span>
                  </li>
                )}
                {e.phone && (
                  <li>
                    <Icon name="phone" />
                    <a href={go("telephone")}>{e.phone}</a>
                  </li>
                )}
                {e.email && (
                  <li>
                    <Icon name="send" />
                    <a href={go("email")}>{e.email}</a>
                  </li>
                )}
                {e.website && (
                  <li>
                    <Icon name="globe" />
                    <a href={go("site")} target="_blank" rel="noopener noreferrer">
                      {e.website.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
                {e.instagram && (
                  <li>
                    <Icon name="heart" />
                    <a href={go("instagram")} target="_blank" rel="noopener noreferrer">
                      {e.instagram}
                    </a>
                  </li>
                )}
              </ul>
              <div className="est-actions">
                {d.whatsapp && (
                  <a className="btn btn-gold btn-sm" href={go("whatsapp")} target="_blank" rel="noopener noreferrer">
                    <Icon name="chat" />
                    WhatsApp
                  </a>
                )}
                {e.phone && (
                  <a className="btn btn-ghost btn-sm" href={go("telephone")}>
                    <Icon name="phone" />
                    Appeler
                  </a>
                )}
                {(e.address || e.lat != null) && (
                  <a className="btn btn-ghost btn-sm" href={go("itineraire")} target="_blank" rel="noopener noreferrer">
                    <Icon name="arrow-r" />
                    Itinéraire
                  </a>
                )}
              </div>
              {e.lat != null && e.lng != null && (
                <MiniMap
                  pin={{ id: e.id, kind: e.kinds.includes("partner") ? "partner" : "pro", lat: e.lat, lng: e.lng, kicker: e.category, title: e.name, subtitle: e.address ?? e.area ?? "", category: d.carnetCategory, href: null }}
                  fallback={[e.address, e.area].filter(Boolean).join(", ") || "Marrakech"}
                />
              )}
            </section>
          </div>
          <div className="est-col">
            {e.kinds.includes("partner") && (
              <section className="card">
                <div className="card-h">
                  <h2 className="h-sm">Offres aux membres</h2>
                  <span className="muted">{offers.length ? `${offers.length} en ce moment` : ""}</span>
                </div>
                {offers.map((o) => {
                  const av = offerAvailability(o, v.profile.plan, t, isAdmin(v.profile));
                  return (
                    <div key={o.id} className="est-offer" id={`offre-${o.id}`}>
                      <div className="est-offer-top">
                        <span className="o-badge">{o.badge}</span>
                        <span>
                          <b>{o.title}</b>
                          <span className="muted" style={{ fontSize: 14.5 }}>
                            {o.detail}
                          </span>
                        </span>
                      </div>
                      <div className="meta">
                        <span className={o.audience === "premium" ? "chip gold" : "chip"}>
                          {o.audience === "premium" && <Icon name="crown" />}
                          {AUDIENCE_LABEL[o.audience]}
                        </span>
                        {o.validUntil && <span className="chip">Jusqu’au {ymdLong(o.validUntil)}</span>}
                      </div>
                      {o.conditions && <p className="cond">{o.conditions}</p>}
                      <div>
                        <UseOfferButton offerId={o.id} title={o.title} orgName={e.name} conditions={o.conditions} disabledReason={av.ok ? null : av.reason} />
                      </div>
                    </div>
                  );
                })}
                {!offers.length && <div className="empty">Pas d’offre en ce moment.</div>}
              </section>
            )}
            <section className="card">
              <h2 className="h-sm">Le bon réflexe</h2>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 15 }}>
                Dis que tu viens de la part du Nomad Club. Une question ? Pose-la au salon : une membre y est sûrement déjà allée.
              </p>
              <div className="btn-row" style={{ marginTop: 14 }}>
                <Link className="btn btn-ghost btn-sm" href="/espace/carte">
                  <Icon name="pin" />
                  Voir sur la carte
                </Link>
                <Link className="btn btn-ghost btn-sm" href="/espace/cercle">
                  <Icon name="chat" />
                  Au salon
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Screen>
  );
}
