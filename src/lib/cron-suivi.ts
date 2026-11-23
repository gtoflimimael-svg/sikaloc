import 'server-only'

import * as Sentry from '@sentry/nextjs'

import { requeteCronAutorisee } from '@/lib/cron-auth'

/**
 * Suivi des crons Vercel dans Sentry (OPS-01).
 *
 * Chaque exécution autorisée ouvre un « check-in » puis le clôt en succès ou en
 * échec. Sentry alerte ainsi sur un cron en erreur, mais aussi sur un cron qui
 * ne tourne plus du tout (créneau manqué) — ce que personne ne voyait avant.
 *
 * Un appel non autorisé (sans CRON_SECRET) ne crée aucun check-in : un tiers ne
 * peut ni masquer une panne ni déclencher de fausse alerte. Sans DSN Sentry,
 * tout ceci est inerte et le cron s'exécute normalement.
 */
export async function suivreCron(
  nom: string,
  planification: string,
  request: Request,
  executer: () => Promise<Response>,
): Promise<Response> {
  if (!Sentry.isEnabled() || !requeteCronAutorisee(request.headers)) return executer()

  const monitorSlug = `sikaloc-cron-${nom}`
  const debut = Date.now()
  const checkInId = Sentry.captureCheckIn(
    { monitorSlug, status: 'in_progress' },
    {
      schedule: { type: 'crontab', value: planification },
      timezone: 'UTC',
      checkinMargin: 15,
      maxRuntime: 10,
    },
  )

  let statut: 'ok' | 'error' = 'error'
  try {
    const reponse = await executer()
    statut = reponse.status < 400 ? 'ok' : 'error'
    return reponse
  } finally {
    Sentry.captureCheckIn({ checkInId, monitorSlug, status: statut, duration: (Date.now() - debut) / 1000 })
    // Fonction serverless : envoyer avant que l'instance ne soit gelée.
    await Sentry.flush(2000)
  }
}
