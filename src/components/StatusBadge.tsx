import { getStatus } from "@/lib/shop-data";

const LABEL = { open: "Open", busy: "Busy", closed: "Closed" } as const;
const DOT = { open: "bg-primary", busy: "bg-[#D98E3A]", closed: "bg-muted-foreground" } as const;

// Static snapshot for now; Realtime updates arrive in Task 12.
export async function StatusBadge() {
  const s = await getStatus();
  if (!s) return null;
  return (
    <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-border bg-card px-4 py-2 font-mono text-[0.8125rem] text-foreground">
      <span className="inline-flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${DOT[s.state]} ${s.state === "open" ? "motion-safe:animate-pulse" : ""}`}
          aria-hidden
        />
        {LABEL[s.state]}
      </span>
      {s.state !== "closed" && (
        <>
          <span className="text-muted-foreground">{s.in_shop} in shop</span>
          <span className="text-muted-foreground">{s.waiting} waiting</span>
        </>
      )}
      {s.note && <span className="w-full font-sans text-muted-foreground">{s.note}</span>}
    </p>
  );
}

export function StatusBadgeFallback() {
  return <span className="block h-[38px] w-40 rounded-full border border-border bg-card" aria-hidden />;
}
