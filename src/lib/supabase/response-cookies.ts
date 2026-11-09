// Applies cookies AND the cache headers @supabase/ssr supplies, so a CDN never caches a session cookie.
export function applyCookies(
  response: { cookies: { set: (n: string, v: string, o?: never) => unknown }; headers: Headers },
  list: { name: string; value: string; options: unknown }[],
  headers: Record<string, string>,
) {
  list.forEach(({ name, value, options }) => response.cookies.set(name, value, options as never));
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
}
