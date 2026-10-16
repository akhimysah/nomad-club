/** Pictogrammes de la maquette (symboles SVG réutilisés via <use>). */
export const ICONS = ["home", "cal", "users", "book", "spark", "user", "heart", "star", "chev-r", "chev-l", "chev-d", "x", "check", "pin", "clock", "ticket", "send", "search", "plus", "inbox", "grid", "wallet", "chat", "bell", "arrow-r", "crown", "gift", "lock", "edit", "swap", "card", "refresh"] as const;
export type IconName = (typeof ICONS)[number];

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gold-stroke" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ededed"/><stop offset=".5" stopColor="#d5d5d5"/><stop offset="1" stopColor="#b6b6b6"/></linearGradient>
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/></symbol>
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
        <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2"/></symbol>
        <symbol id="i-book" viewBox="0 0 24 24"><path d="M4.5 5A1.5 1.5 0 0 1 6 3.5h13.5v14H6a1.5 1.5 0 0 0-1.5 1.5z"/><path d="M4.5 19A1.5 1.5 0 0 0 6 20.5h13.5v-3"/><path d="M9 8h6M9 11.5h4"/></symbol>
        <symbol id="i-spark" viewBox="0 0 24 24"><path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></symbol>
        <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/></symbol>
        <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-9-9.4C2 7.4 4.2 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.1 0 5.3 2.9 4.3 6.1C19.5 15.4 12 20 12 20z"/></symbol>
        <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></symbol>
        <symbol id="i-chev-r" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
        <symbol id="i-chev-l" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
        <symbol id="i-chev-d" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7"/></symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
        <symbol id="i-ticket" viewBox="0 0 24 24"><path d="M3 7h18v3.5a1.5 1.5 0 0 0 0 3V17H3v-3.5a1.5 1.5 0 0 0 0-3z"/><path d="M15 7.5v1.5M15 11.2v1.6M15 15v1.5"/></symbol>
        <symbol id="i-send" viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-2.5-6.5z"/><path d="M11.5 13.5 20 4"/></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
        <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M3.5 13l2.5-8h12l2.5 8v6a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/><path d="M3.5 13h5l1.5 2.5h4l1.5-2.5h5"/></symbol>
        <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></symbol>
        <symbol id="i-wallet" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2"/><path d="M6 6l9-3 1.5 3"/></symbol>
        <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4.5 5.5h15v10.5H10l-5.5 4z"/></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></symbol>
        <symbol id="i-arrow-r" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
        <symbol id="i-crown" viewBox="0 0 24 24"><path d="M3.5 8l4.5 4 4-6.5 4 6.5 4.5-4-2 11h-13z"/></symbol>
        <symbol id="i-gift" viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M3.5 9h17M12 9v11"/><path d="M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zm0 0c1.5-3 5-4 5-1.5S14 9 12 9z"/></symbol>
        <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></symbol>
        <symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></symbol>
        <symbol id="i-swap" viewBox="0 0 24 24"><path d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13"/></symbol>
        <symbol id="i-card" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/></symbol>
        <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16m0 4v-4h-4"/></symbol>
      </defs>
    </svg>
  );
}
