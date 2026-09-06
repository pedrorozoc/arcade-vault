// ===== lib/supabase/proxy.ts — refresco de sesión de Supabase para el proxy =====
// `updateSession` se llama desde `proxy.ts` (raíz) en cada request que matchea.
// Crea un cliente de servidor ligado a las cookies de request/response, llama a
// `auth.getClaims()` para revalidar y refrescar el token si hace falta, y
// devuelve la NextResponse con las cookies actualizadas. Sin lógica de
// protección ni redirección de rutas: eso llega con el spec de Auth.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Sin credenciales configuradas no hay sesión que refrescar: se deja pasar
  // la request tal cual en vez de dejar que `createServerClient` lance. Así el
  // proxy nunca bloquea rutas ni assets cuando falta el entorno (p. ej. un
  // despliegue sin env vars todavía).
  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Revalida y refresca el token; las cookies nuevas se propagan vía `setAll`.
  await supabase.auth.getClaims();

  return response;
}
