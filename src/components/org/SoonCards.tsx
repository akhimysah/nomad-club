import type { IconName } from "../IconSprite";
import { Icon } from "../ui/Icon";

export type SoonItem = { icon: IconName; title: string; text: string; lot: string };

/** Emplacements réservés aux fonctions des lots suivants, clairement marqués « Bientôt ». */
export function SoonCards({ items }: { items: SoonItem[] }) {
  return (
    <div className="soon-cards">
      {items.map((s) => (
        <div key={s.title} className="soon-card" aria-disabled="true">
          <Icon name={s.icon} />
          <b>{s.title}</b>
          <p>{s.text}</p>
          <span className="chip gold">Bientôt · {s.lot}</span>
        </div>
      ))}
    </div>
  );
}
