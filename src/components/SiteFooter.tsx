import Link from "next/link";
import { shopConfig } from "../../shop.config";

const link = "inline-flex min-h-12 items-center px-3 underline decoration-border underline-offset-4 hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="px-5 pb-8 text-center text-xs text-muted-foreground">
      <nav aria-label="Legal" className="flex justify-center">
        <Link href="/privacy" className={link}>Privacy</Link>
        <Link href="/cookies" className={link}>Cookies</Link>
      </nav>
      <p>&copy; {shopConfig.name}</p>
    </footer>
  );
}
