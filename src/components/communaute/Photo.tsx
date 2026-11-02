import { Avatar } from "../ui/Avatar";

/** Photo de profil en noir et blanc, ou pastille aux initiales s'il n'y en a pas. */
export function Photo({ name, src, founder, size }: { name: string; src: string | null; founder?: boolean; size?: "lg" | "xl" }) {
  if (!src) return <Avatar name={name} founder={founder} className={size === "xl" ? "lg" : size} />;
  return <img className={"cm-photo" + (size ? " " + size : "")} src={src} alt="" aria-hidden="true" />;
}
