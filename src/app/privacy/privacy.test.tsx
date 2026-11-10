import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shopConfig } from "../../../shop.config";
import { Analytics } from "@/components/Analytics";
import CookiesPage from "../cookies/page";
import PrivacyPage from "./page";

describe("privacy notice", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);
  it("names every processor from config, the retention period and the rights route", () => {
    for (const p of shopConfig.privacy.processors) expect(html).toContain(p.name);
    expect(html).toContain(`${shopConfig.privacy.retentionYears} years after your appointment`);
    expect(html).toContain("ico.org.uk");
    expect(html).toContain("Delete my data");
    expect(html).toContain("from that booking"); // per-booking erasure; whole-record requests go via the shop
    expect(html).toContain("calling you back");
    expect(html).toContain("anti-abuse record"); // 017: hashed phone + time, 24 hours
    expect(html).toContain("for 24 hours");
    expect(html).toContain(shopConfig.phone);
    expect(html).toContain(shopConfig.address);
  });
  it("is marked draft only in an HTML comment", () => {
    expect(html).toContain("<!-- DRAFT - not legal advice: review before launch -->");
    expect(html.replace(/<!--.*?-->/g, "")).not.toMatch(/draft/i);
    expect(renderToStaticMarkup(<CookiesPage />)).toContain("<!-- DRAFT - not legal advice: review before launch -->");
  });
});

describe("analytics", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is off unless PLAUSIBLE_DOMAIN is set", () => {
    vi.stubEnv("PLAUSIBLE_DOMAIN", "");
    expect(renderToStaticMarkup(<Analytics />)).toBe("");
  });
  it("renders the cookieless Plausible script when configured", () => {
    vi.stubEnv("PLAUSIBLE_DOMAIN", "zizusbarbers.com");
    const html = renderToStaticMarkup(<Analytics />);
    expect(html).toContain('data-domain="zizusbarbers.com"');
    expect(html).toContain('src="https://plausible.io/js/script.exclusions.js"');
    expect(html).toContain('data-exclude="/booking/**, /admin/**, /auth/**"');
  });
  it("cookies page says so when analytics is on", () => {
    vi.stubEnv("PLAUSIBLE_DOMAIN", "zizusbarbers.com");
    expect(renderToStaticMarkup(<CookiesPage />)).toContain("Plausible");
    vi.stubEnv("PLAUSIBLE_DOMAIN", "");
    expect(renderToStaticMarkup(<CookiesPage />)).not.toContain("Plausible");
  });
});
