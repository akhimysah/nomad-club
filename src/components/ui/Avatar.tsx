import type { CSSProperties } from "react";
import { initials } from "@/lib/format";

const COLORS = ["#e1e1e1", "#cecece", "#c8c8c8", "#cdcdcd", "#dbdbdb", "#d8d8d8", "#d2d2d2", "#d5d5d5"];
const FOUNDERS = ["Julia", "Nora"];

/** Pastille aux initiales (couleur stable selon le nom). Les fondatrices ont la pastille argentée. */
export function Avatar({ name, className, founder }: { name: string; className?: string; founder?: boolean }) {
  const f = founder ?? FOUNDERS.includes(name);
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const style = { "--avc": COLORS[h % COLORS.length] } as CSSProperties;
  return (
    <span className={"av" + (f ? " f" : "") + (className ? " " + className : "")} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
