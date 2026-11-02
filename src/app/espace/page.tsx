import { Suspense } from "react";
import { AdhesionCard } from "@/components/member/AdhesionCard";
import { AskHome, PullToRefresh } from "@/components/member/Buttons";
import { Screen } from "@/components/ui/Screen";
import { requireMember } from "@/lib/auth";
import { nowMs, today } from "@/lib/clock";
import { getRepo } from "@/lib/data";
import { fullName, todayLong } from "@/lib/format";
import { listDashboardNews } from "@/lib/modules/engagement/news-source";
import { quoteOfDay } from "@/lib/modules/engagement/quotes";
import type { WidgetId } from "@/lib/modules/engagement/types";
import { resolveWidgets, type ResolvedWidget } from "@/lib/modules/engagement/widgets";
import { membershipState, nextBookingOf, payEnv, ticketData, upcomingFor } from "@/lib/views";
import {
  AddressWidget,
  AgendaWidget,
  EventsWidget,
  NewsWidget,
  NextWidget,
  OffersWidget,
  PointsWidget,
  PrayerWidget,
  QuoteWidget,
  ReferralWidget,
  SalonWidget,
  WeatherWidget,
  WidgetSkeleton,
} from "@/components/engagement/widgets";
import { WidgetCustomizer, type CustomizerItem } from "@/components/engagement/WidgetCustomizer";
import "@/styles/engagement.css";

export const dynamic = "force-dynamic";

/**
 * Accueil membre à widgets (Lot 4). Obligatoires : prochain rendez-vous, actualités, prochains événements.
 * Facultatifs : activés et rangés par chaque membre (préférences enregistrées).
 */
export default async function MemberHome() {
  const v = await requireMember();
  const repo = getRepo();
  const me = v.profile.id;
  const prefs = await repo.getEngagementPrefs(me);
  const widgets = resolveWidgets(prefs?.widgets);
  const on = new Set<WidgetId>(widgets.filter((w) => w.enabled).map((w) => w.id));
  const need = (...ids: WidgetId[]) => ids.some((id) => on.has(id));
  const none = <T,>(x: T) => Promise.resolve(x);

  const [{ events, bookings, mine }, salon, places, m, news, offers, points, deals, code, referrals] = await Promise.all([
    upcomingFor(v),
    need("salon") ? repo.listMessages("general") : none([]),
    need("address") ? repo.listPlaces() : none([]),
    membershipState(v.profile),
    listDashboardNews(3),
    need("offers") ? repo.listPartnerOffers() : none([]),
    need("points") ? repo.listPoints(me) : none([]),
    need("points") ? repo.listDeals({ profileId: me }) : none([]),
    need("referral") ? repo.getReferralCode(me) : none(""),
    need("referral") ? repo.listReferrals({ referrerId: me }) : none([]),
  ]);
  const next = nextBookingOf(bookings);
  const soon = events.filter((e) => e.id !== next?.eventId).slice(0, 3);
  const place = places.find((p) => p.slug === "chonchon-chocolat") ?? places[0] ?? null;
  const t = today();
  const card = { name: fullName(v.profile), premium: m.premium, validUntil: m.endsDots, cardNumber: v.profile.cardNumber ?? "NC 0000" };

  const render = async (id: WidgetId): Promise<React.ReactNode> => {
    switch (id) {
      case "next":
        return <NextWidget next={next} ticket={next ? await ticketData(next) : null} demo={v.mode === "demo"} />;
      case "events":
        return <EventsWidget soon={soon} mine={mine} plan={v.profile.plan} />;
      case "news":
        return <NewsWidget news={news} />;
      case "adhesion":
        return <AdhesionCard m={m} env={payEnv(v)} />;
      case "salon":
        return <SalonWidget salon={salon} />;
      case "ask":
        return <AskHome />;
      case "address":
        return <AddressWidget place={place} />;
      case "agenda":
        return <AgendaWidget bookings={bookings} />;
      case "offers":
        return <OffersWidget offers={offers} card={card} />;
      case "points":
        return (
          <PointsWidget
            total={points.reduce((s, p) => s + p.points, 0)}
            toConfirm={deals.filter((d) => d.status === "pending" && d.partnerId === me).length}
            deals={deals.filter((d) => d.status === "confirmed").length}
          />
        );
      case "referral":
        return <ReferralWidget code={code} signedUp={referrals.filter((r) => r.status === "signed_up").length} members={referrals.filter((r) => r.status === "member").length} />;
      case "quote":
        return <QuoteWidget quote={quoteOfDay(t)} />;
      case "weather":
        return (
          <Suspense fallback={<WidgetSkeleton title="Météo à Marrakech" />}>
            <WeatherWidget />
          </Suspense>
        );
      case "prayer":
        return (
          <Suspense fallback={<WidgetSkeleton title="Heures de prière" />}>
            <PrayerWidget />
          </Suspense>
        );
    }
  };

  const shown = widgets.filter((w) => w.enabled);
  const order = new Map(shown.map((w, i) => [w.id, i]));
  const column = async (col: ResolvedWidget["column"]) =>
    Promise.all(
      shown
        .filter((w) => w.column === col)
        .map(async (w) => (
          <div key={w.id} className={`w w-${w.id}`} style={{ "--o": order.get(w.id) } as React.CSSProperties}>
            {await render(w.id)}
          </div>
        )),
    );
  const [main, side] = await Promise.all([column("main"), column("side")]);
  const toItem = (w: ResolvedWidget): CustomizerItem => ({ id: w.id, label: w.label, hint: w.hint, icon: w.icon, mandatory: w.mandatory, enabled: w.enabled });

  return (
    <Screen group="member" index={0} className="mscreen scroller on">
      <PullToRefresh>
        <div className="dash-head">
          <div className="hello">
            <div className="eyebrow">{todayLong(nowMs(), false)}</div>
            <h1 className="h-display">Bonjour {v.profile.firstName}</h1>
          </div>
          <div className="dash-tools">
            <WidgetCustomizer items={widgets.map(toItem)} defaults={resolveWidgets(null).map(toItem)} />
          </div>
        </div>
        <div className="dash">
          <div className="dash-col main">{main}</div>
          <div className="dash-col side">{side}</div>
        </div>
      </PullToRefresh>
    </Screen>
  );
}
