import Link from "next/link";
import { Icon } from "../ui/Icon";
import { CountBadge } from "../ui/TweenNumber";

/** Cloche des en-têtes : ouvre la page des notifications, avec le nombre de non lues. */
export function NotifBell({ href, count }: { href: string; count: number }) {
  return (
    <Link className="bell" href={href} aria-label={count ? `Notifications : ${count} non lue${count > 1 ? "s" : ""}` : "Notifications"}>
      <Icon name="bell" />
      <CountBadge value={count} className="badge" />
    </Link>
  );
}
