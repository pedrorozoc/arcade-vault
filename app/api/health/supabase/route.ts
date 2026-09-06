// ===== app/api/health/supabase/route.ts — diagnóstico de la integración de Supabase =====
// Healthcheck permanente y mínimo. Comprueba que las dos env vars están
// presentes y pega a `/auth/v1/health` del proyecto con la publishable key.
// Responde 200 { ok: true } solo si ese endpoint responde 200; 503 { ok: false,
// error } en cualquier otro caso. Nunca lanza una excepción sin capturar.

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return Response.json(
      {
        ok: false,
        error:
          "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });

    if (res.ok) {
      return Response.json({ ok: true });
    }

    return Response.json(
      { ok: false, error: `Supabase respondió ${res.status}.` },
      { status: 503 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return Response.json(
      { ok: false, error: `No se pudo contactar con Supabase: ${message}` },
      { status: 503 }
    );
  }
}
