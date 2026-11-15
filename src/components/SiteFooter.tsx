import Link from "next/link";
import { intlPhone } from "@/lib/format";
import { shopConfig } from "../../shop.config";

const link = "inline-flex min-h-12 items-center px-3 underline decoration-border underline-offset-4 hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-primary/20 bg-band px-5 pb-8 pt-10 text-center text-xs text-muted-foreground">
      <p className="font-heading text-xl text-foreground">{shopConfig.name}</p>
      <p className="mt-2">{shopConfig.address}</p>
      <div className="flex flex-wrap justify-center">
        <a href={`tel:+${intlPhone(shopConfig.phone)}`} className={link}>{shopConfig.phone}</a>
        <a href={shopConfig.sameAs[0]} target="_blank" rel="noopener noreferrer" className={link}>Instagram</a>
      </div>
      <nav aria-label="Legal" className="flex justify-center">
        <Link href="/privacy" className={link}>Privacy</Link>
        <Link href="/cookies" className={link}>Cookies</Link>
      </nav>
      <p>&copy; {shopConfig.name}</p>
    </footer>
  );
}
