import type { IconName } from "../IconSprite";
import { STATUS_LABEL, type ActivityType, type ContactStatus } from "@/lib/modules/crm/types";

export function StatusChip({ status }: { status: ContactStatus }) {
  return <span className={"st " + status}>{STATUS_LABEL[status]}</span>;
}

export function Tags({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags.length) return <span className="muted">—</span>;
  return (
    <span className="tagl">
      {tags.slice(0, max).map((t) => (
        <span key={t} className="tag">
          #{t}
        </span>
      ))}
      {tags.length > max && <span className="tag">+{tags.length - max}</span>}
    </span>
  );
}

export const ACTIVITY_ICON: Record<ActivityType, IconName> = {
  call: "phone",
  whatsapp: "chat",
  email: "send",
  meeting: "users",
  note: "edit",
  event: "cal",
  system: "refresh",
};
