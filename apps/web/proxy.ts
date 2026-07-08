// Proxy (Next 16; antes "middleware"): refresca la sesión de Supabase y hace
// checks OPTIMISTAS de acceso (redirects). La autorización real vive en la
// capa de datos y en las server actions (requirePermission) + RLS — P9.
import { createSupabaseServerClient } from "@plataforma/db";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login"]);

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      supabaseResponse = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options),
      );
    },
  });

  // Importante: getUser() refresca el token expirado y escribe las cookies
  // nuevas en supabaseResponse. No usar getSession() aquí (no verifica).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.has(path);

  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Conservar las cookies de sesión refrescadas también en el redirect.
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic) return redirectTo("/login");
  if (user && isPublic) return redirectTo("/");

  return supabaseResponse;
}

export const config = {
  // /api/* queda FUERA: cada route handler trae su propia autenticación
  // (CRON_SECRET en el tick, HMAC en webhooks futuros) y un redirect a
  // /login rompería a los clientes máquina-a-máquina.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
