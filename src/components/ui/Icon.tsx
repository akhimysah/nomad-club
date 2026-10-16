import type { IconName } from "../IconSprite";

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={"ic" + (className ? " " + className : "")} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
