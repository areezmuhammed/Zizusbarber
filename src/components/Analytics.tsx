// Optional cookieless analytics (Plausible-compatible). Off unless PLAUSIBLE_DOMAIN is set; see docs/launch-checklist.md.
export function Analytics() {
  const domain = process.env.PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return <script defer data-domain={domain} src={process.env.PLAUSIBLE_SRC || "https://plausible.io/js/script.js"} />;
}
