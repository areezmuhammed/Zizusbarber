// Optional cookieless analytics (Plausible-compatible). Off unless PLAUSIBLE_DOMAIN is set; see docs/launch-checklist.md.
// Rendered ONLY by public pages (/, /book, /privacy, /cookies): never on /booking/<token>, /admin or /auth.
export function Analytics() {
  const domain = process.env.PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  // The script follows client-side navigations (e.g. the redirect to /booking/<token> after booking), so the
  // private paths are also excluded in the script itself. A custom PLAUSIBLE_SRC must be an "exclusions" variant.
  return (
    <script
      defer
      data-domain={domain}
      data-exclude="/booking/**, /admin/**, /auth/**"
      src={process.env.PLAUSIBLE_SRC || "https://plausible.io/js/script.exclusions.js"}
    />
  );
}
