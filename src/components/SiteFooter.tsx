import Link from "next/link";
import { shopConfig } from "../../shop.config";

const link = "inline-flex min-h-12 items-center px-3 underline decoration-border underline-offset-4 hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-primary/20 bg-band px-5 pb-8 pt-10 text-center text-xs text-muted-foreground">
      <p className="font-heading text-xl text-foreground">{shopConfig.name}</p>
      <nav aria-label="Legal" className="mt-2 flex justify-center">
        <Link href="/privacy" className={link}>Privacy</Link>
        <Link href="/cookies" className={link}>Cookies</Link>
      </nav>
      <p>&copy; {shopConfig.name}</p>
    </footer>
  );
}
