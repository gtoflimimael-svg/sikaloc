import 'server-only'

import { timingSafeEqual } from 'node:crypto'

/**
 * Authentification des routes planifiées.
 *
 * Ces routes déclenchent des effets lourds — envoi d'emails, purge de données —
 * et doivent rester injoignables par un tiers. Elles acceptent :
 *   - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron l'envoie nativement) ;
 *   - `x-cron-secret: <CRON_SECRET>` pour un appelant externe.
 *
 * Sans `CRON_SECRET` configuré, elles sont fermées : mieux vaut une tâche qui
 * ne tourne pas qu'un endpoint de purge ouvert à tous.
 */
export function requeteCronAutorisee(entetes: Headers): boolean {
  const attendu = process.env.CRON_SECRET
  if (!attendu) return false

  const presente =
    entetes.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    entetes.get('x-cron-secret') ??
    ''

  const a = Buffer.from(presente)
  const b = Buffer.from(attendu)

  return a.length === b.length && timingSafeEqual(a, b)
}
