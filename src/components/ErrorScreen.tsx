import { intlPhone } from "@/lib/format";
import { shopConfig } from "../../shop.config";

const t = shopConfig.theme;
const target = { minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9999, padding: "0 28px", fontSize: 16 };

// Shared by app/error.tsx and app/global-error.tsx. Inline styles on purpose: global-error renders without
// globals.css. Never shows the error itself (it may carry server details).
export function ErrorScreen({ retry }: { retry: () => void }) {
  return (
    <main style={{ minHeight: "100dvh", background: t.bg, color: t.text, display: "flex", alignItems: "center", padding: "56px 20px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 448, margin: "0 auto", width: "100%" }}>
        <p style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: 20, margin: 0 }}>{shopConfig.name}</p>
        <h1 style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: 44, lineHeight: 1, fontWeight: 600, margin: "24px 0 0" }}>
          Something went wrong
        </h1>
        <p style={{ color: t.muted, margin: "16px 0 0", lineHeight: 1.5 }}>
          Please try again. If it keeps happening, call us and we will sort it out.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
          <button type="button" onClick={() => retry()} style={{ ...target, border: 0, background: t.accent, color: t.bg, fontWeight: 500, cursor: "pointer" }}>
            Try again
          </button>
          <a href={`tel:+${intlPhone(shopConfig.phone)}`} style={{ ...target, border: `1px solid ${t.muted}`, color: t.text, textDecoration: "none" }}>
            Call {shopConfig.phone}
          </a>
        </div>
      </div>
    </main>
  );
}
