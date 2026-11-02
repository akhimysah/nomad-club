"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CrmResult } from "@/app/actions/crm";
import { useToast } from "../ui/Toasts";

/** Lance une action du CRM : sablier, message (toast), puis rafraîchit la page. */
export function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const run = async <R extends CrmResult>(call: () => Promise<R>, opts: { onOk?: (r: R & { ok: true }) => void; silent?: boolean } = {}): Promise<R> => {
    setBusy(true);
    try {
      const r = await call();
      if (r.ok) {
        if (!opts.silent) toast(r.message, "check");
        opts.onOk?.(r as R & { ok: true });
        start(() => router.refresh());
      } else toast(r.error, "bell");
      return r;
    } catch {
      toast("Une erreur est survenue. Réessayez.", "bell");
      return { ok: false, error: "Erreur" } as R;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}
