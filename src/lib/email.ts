import { Resend } from "resend";

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY no configurada; omitiendo envío a", to);
    return;
  }
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Recupera tu contraseña — S.I.G.T.E.",
    html:
      `<p>Solicitaste recuperar tu contraseña en S.I.G.T.E.</p>` +
      `<p><a href="${resetUrl}">Haz clic aquí para crear una nueva contraseña</a></p>` +
      `<p>Este enlace expira en 30 minutos. Si no fuiste tú, ignora este correo.</p>`,
  });
}
