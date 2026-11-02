"use client";

import type { QrData } from "@/lib/qr";
import { EventImage } from "./EventImage";
import { Icon } from "./Icon";
import { useTilt } from "./useTilt";

export type TicketData = {
  title: string;
  image: string | null;
  imagePosition: string | null;
  dateShort: string;
  time: string;
  venue: string;
  price: string;
  holder: string;
  code: string;
  qr: QrData;
};

/** Billet qui pivote avec reflet (maquette). */
export function Ticket({ t, intro = true, pending = false }: { t: TicketData; intro?: boolean; pending?: boolean }) {
  const ref = useTilt<HTMLDivElement>();
  return (
    <div ref={ref} className={"ticket" + (intro ? " intro" : "")} tabIndex={0} aria-label={`Billet pour ${t.title}`}>
      <div className="tk-media">
        <EventImage image={t.image ?? "lunch-fer7.jpg"} position={t.imagePosition} />
        <div className="veil" />
        <img className="tk-logo" src="/img/logotype-clair.png" alt="Nomad Club" />
        <span className={"chip" + (pending ? " pending" : " solid")}>
          <Icon name={pending ? "clock" : "check"} />
          {pending ? "En attente du virement" : "Confirmé"}
        </span>
      </div>
      <div className="tk-body">
        <div className="eyebrow">Billet · Nomad Club</div>
        <h3>{t.title}</h3>
        <dl className="tk-grid">
          <div>
            <dt>Date</dt>
            <dd>{t.dateShort}</dd>
          </div>
          <div>
            <dt>Heure</dt>
            <dd>{t.time}</dd>
          </div>
          <div>
            <dt>Lieu</dt>
            <dd>{t.venue}</dd>
          </div>
          <div>
            <dt>Tarif</dt>
            <dd>{t.price}</dd>
          </div>
        </dl>
      </div>
      <div className="tk-perf" />
      <div className="tk-foot">
        <div className="tk-qr">
          <svg viewBox={`0 0 ${t.qr.size} ${t.qr.size}`} shapeRendering="crispEdges" aria-hidden="true">
            <path fill="#151515" d={t.qr.d} />
          </svg>
        </div>
        <dl style={{ margin: 0 }}>
          <dt>Au nom de</dt>
          <dd>{t.holder}</dd>
          <div className="tk-code">N° {t.code}</div>
        </dl>
      </div>
      <div className="sheen" />
    </div>
  );
}
