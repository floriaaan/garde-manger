import nodemailer from 'nodemailer'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

const host = env.get('SMTP_HOST', '')
const from = env.get('SMTP_FROM', '')
const user = env.get('SMTP_USER', '')
const password = env.get('SMTP_PASSWORD', '')
const secure = env.get('SMTP_SECURE', false)

export const passwordResetAvailable = Boolean(host && from)

const transporter = passwordResetAvailable
  ? nodemailer.createTransport({
      host,
      port: env.get('SMTP_PORT', 587),
      secure,
      requireTLS: !secure,
      ...(user ? { auth: { user, pass: password } } : {}),
    })
  : null

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  if (!transporter) return
  // Better Auth gives the same response for known and unknown addresses.
  // Do not make SMTP latency or delivery failures reveal which.
  void transporter
    .sendMail({
      from,
      to,
      subject: 'Réinitialiser ton mot de passe Garde-manger',
      text:
        'Pour choisir un nouveau mot de passe, ouvre ce lien (valable une heure) :\n' +
        url +
        "\n\nSi tu n'as rien demandé, ignore ce message.",
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'auth.password_reset_email_failed')
    })
}
