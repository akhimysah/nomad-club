import type { IconName } from "../IconSprite";

export type FounderNavItem = { href: string; icon: IconName; label: string; tab: string; title: string; mobile: boolean };

/** Entrées de l'espace fondatrices. Sur téléphone, les entrées sans onglet passent par « Plus ». */
export const FOUNDER_NAV: FounderNavItem[] = [
  { href: "/fondatrices", icon: "grid", label: "Vue d’ensemble", tab: "Aperçu", title: "Vue d’ensemble", mobile: true },
  { href: "/fondatrices/a-traiter", icon: "inbox", label: "À traiter", tab: "À traiter", title: "À traiter", mobile: true },
  { href: "/fondatrices/membres", icon: "users", label: "Membres", tab: "Membres", title: "Membres", mobile: true },
  { href: "/fondatrices/evenements", icon: "cal", label: "Événements", tab: "Agenda", title: "Événements", mobile: true },
  { href: "/fondatrices/encaissements", icon: "wallet", label: "Encaissements", tab: "Paiements", title: "Encaissements", mobile: true },
  { href: "/fondatrices/communaute", icon: "chat", label: "Communauté", tab: "Communauté", title: "Communauté", mobile: false }, // --- Lot 1 ---
  { href: "/fondatrices/crm", icon: "book", label: "CRM", tab: "CRM", title: "CRM", mobile: false },
  { href: "/fondatrices/roles", icon: "lock", label: "Rôles et accès", tab: "Rôles", title: "Rôles", mobile: false },
  { href: "/fondatrices/journal", icon: "clock", label: "Journal", tab: "Journal", title: "Journal", mobile: false },
  { href: "/fondatrices/notifications", icon: "bell", label: "Notifications", tab: "Notifs", title: "Notifications", mobile: false },
];

export const FOUNDER_PLUS: FounderNavItem = { href: "/fondatrices/plus", icon: "plus", label: "Plus", tab: "Plus", title: "Plus", mobile: true };
