import type { Metadata } from "next";

// Sales demo of the £300 "Basic" package: never indexed, never linked from the full site.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BasicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
