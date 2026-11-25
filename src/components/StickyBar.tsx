import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { intlPhone } from "@/lib/format";
import { shopConfig } from "../../shop.config";

const item =
  "flex min-h-12 items-center justify-center gap-2 rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const phone = intlPhone(shopConfig.phone);

export function StickyBar({ basic = false }: { basic?: boolean }) {
  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/20 bg-background/90 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <div className={`mx-auto grid max-w-2xl gap-2 ${basic ? "grid-cols-2" : "grid-cols-[1.4fr_1fr_1.2fr]"}`}>
        {!basic && (
          <Link href="/book" className={`${item} bg-primary text-primary-foreground`}>
            Book
          </Link>
        )}
        <a href={`tel:+${phone}`} className={`${item} ${basic ? "bg-primary text-primary-foreground" : "border border-primary/30"}`}>
          <Phone className="size-4" aria-hidden /> Call
        </a>
        <a
          href={`https://wa.me/${phone}`}
          className={`${item} border border-primary/30`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="size-4" aria-hidden /> WhatsApp
        </a>
      </div>
    </nav>
  );
}
