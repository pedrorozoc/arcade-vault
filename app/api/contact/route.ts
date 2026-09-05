// ===== app/api/contact/route.ts — envío del formulario de contacto vía Resend =====

import { Resend } from "resend";
import { validateContact, type ContactPayload } from "@/lib/contact";

const FROM = "onboarding@resend.dev";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request): Promise<Response> {
  let payload: Partial<ContactPayload>;
  try {
    payload = (await request.json()) as Partial<ContactPayload>;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo de la petición no válido." }, { status: 400 });
  }

  // Honeypot: si un bot rellena el campo oculto, respondemos OK sin enviar nada.
  if (typeof payload.company === "string" && payload.company.trim() !== "") {
    return Response.json({ ok: true });
  }

  const validationError = validateContact(payload);
  if (validationError) {
    return Response.json({ ok: false, error: validationError }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    return Response.json(
      { ok: false, error: "El servicio de correo no está configurado." },
      { status: 500 },
    );
  }

  const name = payload.name!.trim();
  const email = payload.email!.trim();
  const msg = payload.msg!.trim();

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.6;">
      <h2 style="margin: 0 0 16px;">Nuevo mensaje desde Arcade Vault</h2>
      <p><strong>Nombre:</strong> ${esc(name)}</p>
      <p><strong>Correo:</strong> ${esc(email)}</p>
      <p><strong>Mensaje:</strong></p>
      <p style="white-space: pre-wrap;">${esc(msg)}</p>
    </div>
  `;

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: FROM,
      to,
      replyTo: email,
      subject: `Arcade Vault — Mensaje de ${name}`,
      html,
    });

    if (error) {
      return Response.json(
        { ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." },
        { status: 500 },
      );
    }
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
