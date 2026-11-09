import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Suspense: the guard below reads cookies (request-time data), which cacheComponents requires boundaried.
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-4">Loading…</p>}>{children}</Suspense>;
}
