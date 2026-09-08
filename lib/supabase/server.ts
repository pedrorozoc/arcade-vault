// ===== lib/supabase/server.ts — cliente de Supabase para el lado servidor =====
// Factoría para Server Components, Route Handlers y Server Actions. Envuelve
// `createServerClient` de @supabase/ssr con el `cookies()` de next/headers
// (asíncrono en Next.js 16). El `setAll` va en try/catch: cuando se invoca
// desde un Server Component la escritura de cookies lanza, y ese caso lo
// cubre el refresco de sesión en `proxy.ts` (patrón documentado por Supabase).
// Tipado con el genérico `Database` generado en `./database.types` (SPEC 06).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Invocado desde un Server Component: no se pueden escribir cookies
            // aquí. El refresco efectivo de la sesión ocurre en `proxy.ts`.
          }
        },
      },
    }
  );
}
