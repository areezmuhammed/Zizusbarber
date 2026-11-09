import { ImageResponse } from "next/og";
import { shopConfig } from "../../shop.config";

export const alt = `${shopConfig.name}, barber in ${shopConfig.area}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const t = shopConfig.theme;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 96px", background: t.bg, color: t.text, borderLeft: `16px solid ${t.accent}`,
        }}
      >
        <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{shopConfig.name}</div>
        <div style={{ marginTop: 32, fontSize: 44, color: t.accent }}>{shopConfig.tagline}</div>
        <div style={{ marginTop: 20, fontSize: 32, color: t.muted }}>{shopConfig.address}</div>
      </div>
    ),
    size,
  );
}
