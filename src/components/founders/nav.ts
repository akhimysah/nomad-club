import type { IconName } from "../IconSprite";

export type FounderNavItem = { href: string; icon: IconName; label: string; tab: string; title: string; mobile: boolean };

/** Entrées de l'espace fondatrices. Sur téléphone, les entrées sans onglet passent par « Plus ». */
export const FOUNDER_NAV: FounderNavItem[] = [
  { href: "/fondatrices", icon: "grid", label: "Vue d’ensemble", tab: "Aperçu", title: "Vue d’ensemble", mobile: true },
  { href: "/fondatrices/a-traiter", icon: "inbox", label: "À traiter", tab: "À traiter", title: "À traiter", mobile: true },
  { href: "/fondatrices/membres", icon: "users", label: "Membres", tab: "Membres", title: "Membres", mobile: true },
  { href: "/fondatrices/candidatures", icon: "user", label: "Candidatures", tab: "Candidatures", title: "Candidatures", mobile: false }, // --- Lancement ---
  { href: "/fondatrices/evenements", icon: "cal", label: "Événements", tab: "Agenda", title: "Événements", mobile: true },
  { href: "/fondatrices/encaissements", icon: "wallet", label: "Encaissements", tab: "Paiements", title: "Encaissements", mobile: true },
  { href: "/fondatrices/communaute", icon: "chat", label: "Communauté", tab: "Communauté", title: "Communauté", mobile: false }, // --- Lot 1 ---
  { href: "/fondatrices/crm", icon: "book", label: "CRM", tab: "CRM", title: "CRM", mobile: false },
  { href: "/fondatrices/roles", icon: "lock", label: "Rôles et accès", tab: "Rôles", title: "Rôles", mobile: false },
  { href: "/fondatrices/journal", icon: "clock", label: "Journal", tab: "Journal", title: "Journal", mobile: false },
  { href: "/fondatrices/notifications", icon: "bell", label: "Notifications", tab: "Notifs", title: "Notifications", mobile: false },
  // --- Lot 4 --- (engagement)
  { href: "/fondatrices/boutique", icon: "book", label: "Boutique", tab: "Boutique", title: "Boutique", mobile: false },
  { href: "/fondatrices/parrainage", icon: "gift", label: "Parrainage", tab: "Parrainage", title: "Parrainage", mobile: false },
  { href: "/fondatrices/business", icon: "star", label: "Espace Business", tab: "Business", title: "Espace Business", mobile: false },
  // --- Vague 2 · Contrats ---
  { href: "/fondatrices/contrats", icon: "edit", label: "Contrats", tab: "Contrats", title: "Contrats", mobile: false },
  // --- Vague 2 · paiements ---
  { href: "/fondatrices/paiements", icon: "card", label: "Paiements et échéances", tab: "Échéances", title: "Paiements", mobile: false },
  // --- Lot 6 ---
  { href: "/fondatrices/securite", icon: "lock", label: "Sécurité et données", tab: "Sécurité", title: "Sécurité", mobile: false },
  // --- E-mails ---
  { href: "/fondatrices/emails", icon: "send", label: "E-mails", tab: "E-mails", title: "E-mails", mobile: false },
];

export const FOUNDER_PLUS: FounderNavItem = { href: "/fondatrices/plus", icon: "plus", label: "Plus", tab: "Plus", title: "Plus", mobile: true };
