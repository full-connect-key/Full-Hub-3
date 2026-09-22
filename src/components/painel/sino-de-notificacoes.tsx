"use client";

import { Bell } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Sino de notificações.
 *
 * A contagem chega zerada neste sprint. O contador só aparece quando há algo:
 * um "0" permanente em cima do sino vira ruído e ensina a pessoa a ignorar o
 * lugar justamente onde as notificações vão aparecer.
 */
export function SinoDeNotificacoes({ count = 0 }: { count?: number }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={count > 0 ? `${count} notificações` : "Notificações"}
      onClick={() =>
        toast.info(
          count > 0 ? `Você tem ${count} notificações.` : "Você não tem notificações.",
        )
      }
    >
      <Bell aria-hidden />
      {count > 0 ? (
        <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  );
}
