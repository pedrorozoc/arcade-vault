// ===== lib/contact.ts — payload y validación del formulario de contacto =====
// Reglas compartidas por el cliente (app/acerca-de/page.tsx) y el servidor
// (app/api/contact/route.ts) para no duplicar la validación.

export interface ContactPayload {
  name: string;
  email: string;
  msg: string;
  company?: string; // honeypot: siempre vacío en envíos legítimos
}

export const MAX_NAME = 100;
export const MAX_EMAIL = 150;
export const MAX_MSG = 5000;

// Regex simple: algo@algo.algo sin espacios. Suficiente para un honeypot-grade check;
// la validación real de entregabilidad la hace Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve el primer mensaje de error de validación, o null si el payload es válido.
export function validateContact(payload: Partial<ContactPayload>): string | null {
  const name = (payload.name ?? "").trim();
  const email = (payload.email ?? "").trim();
  const msg = (payload.msg ?? "").trim();

  if (!name) return "El nombre es obligatorio.";
  if (!email) return "El correo electrónico es obligatorio.";
  if (!msg) return "El mensaje es obligatorio.";

  if (name.length > MAX_NAME) return `El nombre no puede superar ${MAX_NAME} caracteres.`;
  if (email.length > MAX_EMAIL) return `El correo no puede superar ${MAX_EMAIL} caracteres.`;
  if (msg.length > MAX_MSG) return `El mensaje no puede superar ${MAX_MSG} caracteres.`;

  if (!EMAIL_RE.test(email)) return "El correo electrónico no tiene un formato válido.";

  return null;
}
