// ===== proxy.ts — proxy raíz (antes middleware.ts, renombrado en Next.js 16) =====
// Delega en `updateSession` para refrescar la sesión de Supabase en cada
// request que matchea. Sin protección de rutas ni redirecciones: eso llega
// con el spec de Auth. El runtime es Node.js por defecto y no se puede
// cambiar en archivos de proxy (Next.js 16).

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Matchea todas las rutas salvo las que empiezan por:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - archivos de imagen (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
