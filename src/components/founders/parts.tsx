import Link from "next/link";
import type { Dashboard, TodoDraft, TodoRel, TodoVir } from "@/lib/domain/founders";
import { dayMonthShort, money } from "@/lib/format";
import type { ClubEvent, EventStats } from "@/lib/types";
import { Avatar } from "../ui/Avatar";
import { EventImage } from "../ui/EventImage";
import { Icon } from "../ui/Icon";
import { Lingering } from "../ui/Lingering";
import { TweenNumber } from "../ui/TweenNumber";
import { ActionButton, ValidateAllButton } from "./ActionButton";
import { ChoosePlaceButton, NewEventButton } from "./FounderHost";

export function FHead({ title, sub, withNew }: { title: string; sub: string; withNew?: boolean }) {
  return (
    <div className="scr-head">
      <div>
        <div className="eyebrow">{sub}</div>
        <h1 className="scr-title">{title}</h1>
      </div>
      {withNew && <NewEventButton className="btn btn-ink" label="Nouvel événement" />}
    </div>
  );
}

export function SumChips({ d }: { d: Dashboard }) {
  const data: Array<[number, string, boolean]> = [
    [d.counts.vir, "virements à valider", true],
    [d.counts.renew, "renouvellements à relancer", false],
    [d.counts.lapsed, "adhésions échues", false],
    [d.counts.unpaid, "rendez-vous impayés", true],
    [d.counts.free, "comptes gratuits à faire adhérer", false],
    [d.counts.draft, "brouillons à publier", false],
  ];
  return (
    <div className="sum-chips">
      {data.map(([n, label, urg]) => (
        <Link key={label} href="/fondatrices/a-traiter" className={"sum-chip" + (urg ? " urg" : "") + (n === 0 ? " zero" : "")}>
          <b>
            <TweenNumber value={n} />
          </b>
          {label}
        </Link>
      ))}
    </div>
  );
}

export function Summary({ d, compact }: { d: Dashboard; compact?: boolean }) {
  if (compact)
    return (
      <section className="f-sum" style={{ padding: "22px 26px" }}>
        <h2 style={{ fontSize: 26, margin: "0 0 14px" }}>
          <b>
            <TweenNumber value={d.total} />
          </b>{" "}
          actions, dont{" "}
          <b className="r">
            <TweenNumber value={d.urgent} /> urgentes
          </b>
          .
        </h2>
        <SumChips d={d} />
      </section>
    );
  return (
    <section className="f-sum">
      <img className="mono-bg" src="/img/monogramme-clair.png" alt="" />
      <div className="eyebrow">Bonjour Julia et Nora</div>
      <h2>
        <b>
          <TweenNumber value={d.total} />
        </b>{" "}
        actions à traiter, dont{" "}
        <b className="r">
          <TweenNumber value={d.urgent} /> urgentes
        </b>
        .
      </h2>
      <SumChips d={d} />
    </section>
  );
}

function rowAvatar(kind: "vir" | "rel" | "draft", r: TodoVir | TodoRel | TodoDraft) {
  if (kind === "draft")
    return (
      <span className="av" style={{ ["--avc" as string]: "#e3e3e3" }}>
        <Icon name="cal" />
      </span>
    );
  if (kind === "rel" && (r as TodoRel).isEvent)
    return (
      <span className="av" style={{ ["--avc" as string]: "#dbdbdb" }}>
        <Icon name="ticket" />
      </span>
    );
  return <Avatar name={(r as TodoVir).name} />;
}

export function VirRow({ r }: { r: TodoVir }) {
  const key = `vir:${r.id}`;
  return (
    <div className="trow" data-row={key}>
      {rowAvatar("vir", r)}
      <div className="who">
        <b>{r.name}</b>
        <span>
          {r.what} · {r.date}
          <span className="m-only"> · {money(r.amount)}</span>
        </span>
      </div>
      <span className="tamt">{money(r.amount)}</span>
      <span className="tact">
        <ActionButton kind="vir" target={r.id} rowKey={key} label="Valider" />
      </span>
    </div>
  );
}

export function RelRow({ r }: { r: TodoRel }) {
  const key = `rel:${r.key}`;
  return (
    <div className="trow" data-row={key}>
      {rowAvatar("rel", r)}
      <div className="who">
        <b>{r.name}</b>
        <span>
          <span className={r.urgent ? "urg" : undefined}>{r.when}</span> · {r.what} · {r.last}
          {r.amount > 0 && <span className="m-only"> · {money(r.amount)}</span>}
        </span>
      </div>
      <span className="tamt">{r.amount ? money(r.amount) : ""}</span>
      <span className="tact">
        <ActionButton kind={r.cat === "free" ? "invite" : "rel"} target={r.key} rowKey={key} label={r.cat === "free" ? "Inviter" : "Relancer"} />
      </span>
    </div>
  );
}

export function DraftRow({ r }: { r: TodoDraft }) {
  const key = `draft:${r.id}`;
  return (
    <div className="trow" data-row={key}>
      {rowAvatar("draft", r)}
      <div className="who">
        <b>{r.title}</b>
        <span>
          {r.date} · {r.venue ? `${r.venue} · ${r.capacity} places` : <span className="urg">lieu à confirmer avant publication</span>}
        </span>
      </div>
      <span className="tamt" />
      <span className="tact">{r.venue ? <ActionButton kind="pub" target={r.id} rowKey={key} label="Publier" /> : <ChoosePlaceButton d={{ id: r.id, title: r.title, date: r.date }} />}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Icon name="check" />
      {text}
    </div>
  );
}

/** Les trois groupes « À traiter » : virements, relances, brouillons. */
export function TodoGroups({ d, full }: { d: Dashboard; full: boolean }) {
  const shownRel = full ? d.rel : d.rel.slice(0, 4);
  const others = d.rel.length - shownRel.length;
  const sumVir = d.vir.reduce((a, r) => a + r.amount, 0);
  const sumRel = d.rel.reduce((a, r) => a + r.amount, 0);
  return (
    <>
      <div className="tg">
        <div className="tg-h">
          <span className="tg-ic r">
            <Icon name="check" />
          </span>
          <h3>
            Valider {d.vir.length} virement{d.vir.length > 1 ? "s" : ""}
          </h3>
          <span className="amt">
            <TweenNumber value={sumVir} format="money" />
          </span>
        </div>
        <p className="tg-hint">Vérifiez chaque virement sur le compte avant de valider.</p>
        <Lingering items={d.vir.map((r) => ({ key: `vir:${r.id}`, node: <VirRow r={r} /> }))} empty={<Empty text="Tous les virements sont validés." />} />
        {d.vir.length > 1 && (
          <div className="tg-foot">
            <span className="muted" style={{ fontSize: 14 }}>
              {d.vir.length} virements déclarés
            </span>
            <ValidateAllButton keys={d.vir.map((r) => `vir:${r.id}`)} />
          </div>
        )}
      </div>
      <div className="tg">
        <div className="tg-h">
          <span className="tg-ic">
            <Icon name="bell" />
          </span>
          <h3>
            Relancer · {d.rel.length} relance{d.rel.length > 1 ? "s" : ""}
          </h3>
          <span className="amt">
            <TweenNumber value={sumRel} format="money" />
          </span>
        </div>
        <p className="tg-hint">Un message WhatsApp prérempli part à chaque relance.</p>
        <Lingering items={shownRel.map((r) => ({ key: `rel:${r.key}`, node: <RelRow r={r} /> }))} empty={<Empty text="Plus rien d’urgent à relancer." />} />
        {!full && others > 0 && (
          <div className="tg-foot">
            <span className="muted" style={{ fontSize: 14.5 }}>
              {others} autre{others > 1 ? "s" : ""} à relancer
            </span>
            <Link className="link" href="/fondatrices/a-traiter">
              Tout voir <Icon name="arrow-r" />
            </Link>
          </div>
        )}
      </div>
      <div className="tg">
        <div className="tg-h">
          <span className="tg-ic">
            <Icon name="edit" />
          </span>
          <h3>
            Publier {d.drafts.length} brouillon{d.drafts.length > 1 ? "s" : ""}
          </h3>
        </div>
        <Lingering items={d.drafts.map((r) => ({ key: `draft:${r.id}`, node: <DraftRow r={r} /> }))} empty={<Empty text="Aucun brouillon en attente." />} />
      </div>
    </>
  );
}

export function FillBar({ stats, capacity }: { stats: EventStats; capacity: number }) {
  return (
    <div className="fill">
      <i className="paid" style={{ width: `${(stats.paid / Math.max(1, capacity)) * 100}%` }} />
      <i className="pend" style={{ width: `${(stats.pending / Math.max(1, capacity)) * 100}%` }} />
    </div>
  );
}

export function FillRow({ event, stats }: { event: ClubEvent; stats: EventStats }) {
  const l = stats.left;
  return (
    <div className="fev">
      <span className="ph">
        <EventImage image={event.image} position={event.imagePosition} zoom={event.imageZoom} />
      </span>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <b>{event.title}</b>
          <span className="meta">{dayMonthShort(event.startsAt)}</span>
        </div>
        <FillBar stats={stats} capacity={event.capacity} />
        <div className="nums">
          <span>
            {stats.taken}/{event.capacity}
            {l <= 0 ? ` · complet${stats.waitlist ? `, ${stats.waitlist} en liste d’attente` : ""}` : ` · ${l} place${l > 1 ? "s" : ""}`}
          </span>
          <span>
            {stats.paid} payée{stats.paid > 1 ? "s" : ""}
            {event.premiumFree ? " ou offertes" : ""}
            {stats.pending ? ` · ${stats.pending} en attente` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DraftFillRow({ d }: { d: TodoDraft }) {
  return (
    <div className="fev">
      <span className="ph draft" style={{ fontSize: 14 }}>
        <Icon name="edit" />
      </span>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <b>{d.title}</b>
          <span className="chip" style={{ height: 24, fontSize: 12 }}>
            Brouillon
          </span>
        </div>
        <div className="fill">
          <i style={{ width: 0 }} />
        </div>
        <div className="nums">
          <span>
            0/{d.capacity} · {d.date}
          </span>
          <span>{d.venue ?? "lieu à confirmer"}</span>
        </div>
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="lg-paid" />
        Payées ou offertes
      </span>
      <span>
        <i className="lg-pend" />
        En attente de paiement
      </span>
    </div>
  );
}

export function Dues({ d }: { d: Dashboard }) {
  const max = Math.max(1, ...d.dues.map((x) => x.count));
  return (
    <div className="dues">
      {d.dues.map((x, i) => (
        <div key={x.label}>
          <b>{x.count}</b>
          <i className={i < 2 ? "hot" : undefined} style={{ height: `${(x.count / max) * 100}%`, animationDelay: `${i * 0.06}s` }} />
          <span>{x.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Spark({ values }: { values: number[] }) {
  const w = 200;
  const h = 60;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - ((v - min) / span) * h * 0.85 - 4]);
  const d = "M" + pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L");
  return (
    <svg className="spark" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d3d3d3" stopOpacity=".35" />
          <stop offset="1" stopColor="#d3d3d3" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L200 60 L0 60Z`} fill="url(#spf)" />
      <path d={d} fill="none" stroke="#b6b6b6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
