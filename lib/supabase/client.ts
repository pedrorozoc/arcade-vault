// ===== lib/supabase/client.ts — cliente de Supabase para componentes de cliente =====
// Factoría para usar desde componentes con "use client". Envuelve
// `createBrowserClient` de @supabase/ssr, que persiste la sesión en cookies
// para que el render de servidor pueda leerla. No lleva genérico `Database`
// todavía: se retipará cuando exista esquema (ver SPEC 04).

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
