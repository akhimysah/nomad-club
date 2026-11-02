import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptTermsAction, onboardingAction } from "@/app/actions/lancement";
import { ProfileEditor } from "@/components/communaute/ProfileEditor";
import { BasicProfileForm } from "@/components/lancement/BasicProfileForm";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ConsentList } from "@/components/securite/ConsentList";
import { InstallHelp } from "@/components/securite/InstallHelp";
import { PushToggle } from "@/components/securite/PushToggle";
import { Icon } from "@/components/ui/Icon";
import { getViewer, viewerCan } from "@/lib/auth";
import { getRepo } from "@/lib/data";
import { hour } from "@/lib/format";
import { nextStep, parseStep } from "@/lib/modules/lancement/domain";
import { ONBOARDING_STEPS, ONBOARDING_STEP_LABEL, type OnboardingStep } from "@/lib/modules/lancement/types";
import { consentStates } from "@/lib/modules/securite/consents";
import { vapidPublicKey } from "@/lib/modules/securite/push";
import { safeRedirectPath } from "@/lib/modules/securite/request";
import { loadNotifications } from "@/lib/notifications-view";
import { inCircle } from "@/lib/permissions";
import "@/styles/lancement.css";
import "@/styles/securite.css";

export const metadata: Metadata = { title: "Bienvenue", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ etape?: string; suite?: string; parcours?: string }> };

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Casablanca" });

const INTRO: Record<OnboardingStep, { title: string; sub: string }> = {
  profile: { title: "Ta fiche", sub: "Une photo et quelques mots : c’est ce que les autres membres verront de toi." },
  privacy: { title: "Ta confidentialité", sub: "Tu choisis ce que tu partages. Tout se modifie plus tard dans « Mes données »." },
  notifications: { title: "Tes notifications", sub: "Choisis ce qui mérite de te prévenir : réservations, nouveaux rendez-vous, messages…" },
  install: { title: "L’appli sur ton écran d’accueil", sub: "Elle s’ouvre comme une appli, en plein écran, même avec une connexion faible." },
};

/** Vague 2 — Onboarding après la première connexion : quatre écrans légers, sautables, repris depuis « Moi ». */
export default async function WelcomePage({ searchParams }: Props) {
  const { etape, suite: rawSuite, parcours } = await searchParams;
  const viewer = await getViewer();
  const suite = rawSuite ? safeRedirectPath(rawSuite, "/") : parcours === "adhesion" ? "/candidature" : null;
  if (!viewer.profile) {
    if (viewer.mode === "real") redirect(`/connexion?suite=${encodeURIComponent("/bienvenue")}`);
    return (
      <div className="vscreen on">
        <section className="vsec">
          <div className="wrap">
            <div className="card lc-card">
              <div className="eyebrow">Bienvenue</div>
              <h1 className="sh-title">Les premiers pas</h1>
              <p className="sh-sub">Après sa première connexion, une nouvelle inscrite complète ici sa fiche, ses réglages de confidentialité et de notifications, puis installe l’appli. En démo, ouvre l’espace Membre puis « Moi » → « Reprendre la bienvenue ».</p>
              <Link className="btn btn-gold" href="/espace/moi">
                Espace Membre <Icon name="arrow-r" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }
  const p = viewer.profile;
  const repo = getRepo();
  const o = await repo.getOnboarding(p.id);
  const keep = suite ? `&suite=${encodeURIComponent(suite)}` : "";

  // CGU pas encore acceptées (compte créé sans le formulaire d'inscription)
  if (!o.termsAcceptedAt) {
    return (
      <div className="vscreen on">
        <section className="vsec">
          <div className="wrap">
            <div className="card lc-card">
              <div className="eyebrow">Bienvenue, {p.firstName}</div>
              <h1 className="sh-title">Avant de commencer</h1>
              <p className="sh-sub">Prends une minute pour lire nos conditions et notre politique de confidentialité.</p>
              <form action={acceptTermsAction}>
                {suite && <input type="hidden" name="suite" value={suite} />}
                <label className="lc-check">
                  <input type="checkbox" name="terms" required />
                  <span>
                    J’accepte les <Link href="/cgu" target="_blank">conditions d’utilisation</Link> et la <Link href="/confidentialite" target="_blank">politique de confidentialité</Link>.
                  </span>
                </label>
                <button className="btn btn-gold btn-block" type="submit">
                  Continuer <Icon name="arrow-r" />
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const step = parseStep(etape) ?? nextStep(o) ?? "profile";
  const index = ONBOARDING_STEPS.indexOf(step);
  const last = index === ONBOARDING_STEPS.length - 1;
  const member = inCircle(p);

  let content: React.ReactNode = null;
  if (step === "profile") {
    if (member && viewerCan(viewer, "directory.edit_own")) {
      const d = await repo.getDirectoryProfile(p.id);
      content = (
        <ProfileEditor
          email={p.email}
          initial={{
            firstName: p.firstName,
            lastName: p.lastName,
            job: p.job,
            country: p.country,
            marrakechSince: p.marrakechSince,
            bio: p.bio,
            whatsapp: p.whatsapp,
            avatarUrl: p.avatarUrl,
            company: d?.company ?? null,
            sector: d?.sector ?? null,
            skills: (d?.skills ?? []).join(", "),
            instagram: d?.instagram ?? null,
            linkedin: d?.linkedin ?? null,
            website: d?.website ?? null,
            lookingFor: d?.lookingFor ?? null,
            offering: d?.offering ?? null,
            visibility: d?.visibility ?? "all",
            showWhatsapp: d?.showWhatsapp ?? false,
            showEmail: d?.showEmail ?? false,
          }}
        />
      );
    } else {
      content = <BasicProfileForm initial={{ firstName: p.firstName, lastName: p.lastName, job: p.job ?? "", country: p.country ?? "", whatsapp: p.whatsapp ?? "", avatarUrl: p.avatarUrl }} onSaved="lc-next" />;
    }
  } else if (step === "privacy") {
    const history = await repo.listConsents(p.id);
    const states = consentStates(history).map((s) => ({ ...s, when: s.at ? `${dateFr(s.at)} à ${hour(s.at)}` : null }));
    content = (
      <>
        <ConsentList states={states} />
        <p className="muted" style={{ fontSize: 14 }}>
          Historique, export et suppression de compte : <Link href={member ? "/espace/moi/donnees" : "/mes-donnees"}>Mes données</Link>.
        </p>
      </>
    );
  } else if (step === "notifications") {
    const { prefs } = await loadNotifications(p.id, { staff: viewerCan(viewer, "crm.access") });
    content = (
      <>
        <NotificationCenter items={[]} prefs={prefs} />
        <div style={{ marginTop: 14 }}>
          <PushToggle vapidKey={vapidPublicKey()} demo={viewer.mode === "demo"} />
        </div>
      </>
    );
  } else {
    content = (
      <>
        <p className="muted">Sur iPhone : bouton Partager de Safari, puis « Sur l’écran d’accueil ». Sur Android : menu de Chrome, puis « Installer l’application ».</p>
        <InstallHelp className="btn btn-ghost" />
      </>
    );
  }

  return (
    <div className="vscreen on">
      <section className="vsec">
        <div className="wrap">
          <div className="card lc-card">
            <div className="eyebrow">
              Bienvenue, {p.firstName} · étape {index + 1} sur {ONBOARDING_STEPS.length}
            </div>
            <nav aria-label="Étapes de la bienvenue">
              <ol className="lc-steps">
                {ONBOARDING_STEPS.map((s, i) => (
                  <li key={s} className={s === step ? "on" : o.stepsDone.includes(s) || i < index ? "done" : ""}>
                    <Link href={`/bienvenue?etape=${s}${keep}`} aria-current={s === step ? "step" : undefined}>
                      {ONBOARDING_STEP_LABEL[s]}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
            <h1 className="sh-title" style={{ fontSize: 34 }}>
              {INTRO[step].title}
            </h1>
            <p className="sh-sub">{INTRO[step].sub}</p>
            {content}
            <form action={onboardingAction} className="lc-actions">
              <input type="hidden" name="step" value={step} />
              {suite && <input type="hidden" name="suite" value={suite} />}
              <button id="lc-next" className="btn btn-gold" type="submit" name="intent" value={last ? "finish" : "next"}>
                {last ? "Terminer" : "Continuer"} <Icon name="arrow-r" />
              </button>
              {!last && (
                <button className="lc-link-btn" type="submit" name="intent" value="skip-step">
                  Passer cette étape
                </button>
              )}
              <button className="lc-link-btn lc-skip" type="submit" name="intent" value="skip-all">
                Plus tard
              </button>
            </form>
            <p className="fine">Tu pourras reprendre ces étapes à tout moment depuis « Moi ».</p>
          </div>
        </div>
      </section>
    </div>
  );
}
