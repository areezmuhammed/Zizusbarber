import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { shopConfig } from "../../../shop.config";

export const metadata: Metadata = {
  title: `Cookie notice | ${shopConfig.name}`,
  description: `${shopConfig.name} uses no tracking or advertising cookies.`,
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  const analytics = !!process.env.PLAUSIBLE_DOMAIN;
  return (
    <LegalPage title="Cookie notice" updated="9 November 2026">
      <p>
        Cookies are small files a website saves in your browser. We keep them to the minimum, so there is nothing to
        accept or turn off.
      </p>

      <h2>Cookies we use</h2>
      <p>
        Only strictly necessary ones: when the shop owner signs in to manage the diary, a session cookie keeps them
        signed in. Customers booking an appointment get no cookies from us.
      </p>

      <h2>What we do not use</h2>
      <p>No analytics cookies, no advertising cookies and no tracking across other websites.</p>
      {analytics && (
        <p>
          To count visits we use Plausible Analytics, which works without cookies and does not collect personal data
          or follow you across websites.
        </p>
      )}

      <h2>More about your data</h2>
      <p>
        Read our <a href="/privacy">privacy notice</a> for what we do with your booking details.
      </p>
    </LegalPage>
  );
}
