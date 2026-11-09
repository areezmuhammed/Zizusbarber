import { createServerClient } from "@supabase/ssr";
import { applyCookies } from "@/lib/supabase/response-cookies";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookies; authorisation itself happens in the admin layout.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        applyCookies(response, list, headers);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = { matcher: ["/admin/:path*", "/auth/:path*"] };
