"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchSpace } from "@/app/actions/space";
import type { Space } from "@/lib/permissions";
import { lastPath, SPACES } from "./spaces";

/**
 * Bascule vers un autre espace. En démo, change le rôle (cookie) puis navigue ;
 * en mode réel, simple lien (la garde d'accès demande la connexion si besoin).
 */
export function SpaceButton({
  space,
  demo,
  className,
  children,
  href,
  onDone,
}: {
  space: Space;
  demo: boolean;
  className?: string;
  children: React.ReactNode;
  href?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const target = href ?? SPACES[space].home;
  if (!demo) {
    return (
      <Link href={target} className={className} onClick={onDone}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          await switchSpace(space);
          onDone?.();
          router.push(href ?? lastPath(space));
        })
      }
    >
      {children}
    </button>
  );
}
