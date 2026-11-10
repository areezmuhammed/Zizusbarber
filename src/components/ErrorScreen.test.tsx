import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { shopConfig } from "../../shop.config";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import { ErrorScreen } from "./ErrorScreen";

describe("error boundaries", () => {
  const secret = Object.assign(new Error("db password is hunter2"), { digest: "123" });

  it("shows the branded message, a retry button and the shop phone, never the error", () => {
    for (const html of [
      renderToStaticMarkup(<ErrorPage error={secret} retry={() => {}} />),
      renderToStaticMarkup(<GlobalError error={secret} retry={() => {}} />),
    ]) {
      expect(html).toContain("Something went wrong");
      expect(html).toContain(">Try again</button>");
      expect(html).toContain('href="tel:+447535423544"');
      expect(html).toContain(shopConfig.phone);
      expect(html).toContain("min-height:48px");
      expect(html).not.toContain("hunter2");
      expect(html).not.toContain("123");
    }
    expect(renderToStaticMarkup(<GlobalError error={secret} retry={() => {}} />)).toMatch(/^<html lang="en-GB"/);
  });

  it("Try again calls retry()", () => {
    const retry = vi.fn();
    const main = ErrorScreen({ retry });
    const find = (n: unknown): { props: { onClick?: () => void } } | undefined => {
      if (!n || typeof n !== "object") return;
      const el = n as { type?: unknown; props?: { children?: unknown } };
      if (el.type === "button") return el as { props: { onClick?: () => void } };
      const kids = el.props?.children;
      for (const k of Array.isArray(kids) ? kids : [kids]) {
        const hit = find(k);
        if (hit) return hit;
      }
    };
    find(main)!.props.onClick!();
    expect(retry).toHaveBeenCalledOnce();
  });
});
