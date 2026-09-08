// ===== lib/supabase/client.ts — cliente de Supabase para componentes de cliente =====
// Factoría para usar desde componentes con "use client". Envuelve
// `createBrowserClient` de @supabase/ssr, que persiste la sesión en cookies
// para que el render de servidor pueda leerla. Tipado con el genérico
// `Database` generado en `./database.types` (SPEC 06).

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
