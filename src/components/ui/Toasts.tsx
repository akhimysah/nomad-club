"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { IconName } from "../IconSprite";
import { Icon } from "./Icon";

type Toast = { id: number; text: string; icon: IconName; out: boolean };
type ToastFn = (text: string, icon?: IconName) => void;

const Ctx = createContext<ToastFn>(() => {});

export function useToast(): ToastFn {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback<ToastFn>((text, icon = "check") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, icon, out: false }]);
    setTimeout(() => setItems((l) => l.map((t) => (t.id === id ? { ...t, out: true } : t))), 3200);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div id="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={"toast" + (t.out ? " out" : "")} role="status">
            <span className="ti">
              <Icon name={t.icon} />
            </span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
