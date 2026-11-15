"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Images, SlidersHorizontal, Users } from "lucide-react";

const TABS = [
  ["Today", "/admin", CalendarDays],
  ["Status", "/admin/status", Users],
  ["Settings", "/admin/settings", SlidersHorizontal],
  ["Gallery", "/admin/gallery", Images],
] as const;

// Fixed bottom tab bar, thumb-reachable on a phone; the current tab is brass and aria-current.
export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map(([name, href, Icon]) => {
          const current = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className="relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors aria-[current=page]:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              >
                {current && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />}
                <Icon aria-hidden className="size-6" strokeWidth={current ? 2.25 : 1.75} />
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
