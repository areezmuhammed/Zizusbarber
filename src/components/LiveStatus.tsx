"use client";

import { useEffect, useState } from "react";
import type { Closure } from "@/lib/booking-form";
import { startLive } from "@/lib/live-status";
import { effectiveStatus } from "@/lib/open-now";
import type { Hours, Status } from "@/lib/shop-data";
import { useNow } from "@/lib/use-now";
import { createClient } from "@/lib/supabase/client";

let channels = 0; // unique topic per subscribe: realtime-js returns an existing same-topic channel, even one still leaving

const LABEL = { open: "Open", busy: "Busy", closed: "Closed" } as const;
const DOT = { open: "bg-primary", busy: "bg-[#D98E3A]", closed: "bg-muted-foreground" } as const;

// Initial value comes from the (cached) server render; Realtime then keeps it current, with a 30s poll as fallback.
// Open/closed follows opening hours unless the owner picked a state today (effectiveStatus).
export function LiveStatus({ initial, hours, closures, now }: { initial: Status; hours: Hours[]; closures: Closure[]; now: number }) {
  const [row, setS] = useState(initial);
  const at = useNow(now);
  const e = effectiveStatus(row, hours, closures, at);
  const s = { ...row, state: e.state };

  useEffect(() => {
    const db = createClient();
    return startLive({
      onStatus: setS,
      fetchRow: async () => (await db.from("shop_status").select("state,in_shop,waiting,note,manual_date").maybeSingle()).data,
      subscribe: (onRow, onState) => {
        const name = `shop_status_live_${++channels}`;
        const ch = db
          .channel(name)
          .on("postgres_changes", { event: "*", schema: "public", table: "shop_status" }, (p) => onRow(p.new))
          .subscribe((st) => onState(st === "SUBSCRIBED"));
        return () => void db.removeChannel(ch);
      },
    });
  }, []);

  return (
    <p
      aria-live="polite"
      data-testid="status-badge"
      className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-border bg-card px-4 py-2 font-mono text-[0.8125rem] text-foreground"
    >
      <span className="inline-flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${DOT[s.state]} ${s.state === "open" ? "motion-safe:animate-pulse" : ""}`}
          aria-hidden
        />
        {LABEL[s.state]}
        {e.next && <span className="text-muted-foreground">· {e.next}</span>}
      </span>
      {s.state !== "closed" && (
        <span className="text-muted-foreground">
          {s.in_shop} in shop, {s.waiting} waiting
        </span>
      )}
      {s.note && <span className="w-full font-sans text-muted-foreground">{s.note}</span>}
    </p>
  );
}
