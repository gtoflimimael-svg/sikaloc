import { NextResponse, type NextRequest } from 'next/server'

import { requeteCronAutorisee } from '@/lib/cron-auth'
import { emailOperationnel, envoyerEmail, type ModeleEmail, type VariablesEmail } from '@/lib/emails'
import { viderNotifications, type TransportNotification } from '@/lib/file-notifications'
import { envoyerWhatsApp, whatsAppOperationnel, type ModeleWhatsApp, type VariablesWhatsApp } from '@/lib/whatsapp-transport'
import { creerClientAdmin } from '@/lib/supabase/admin'

export const maxDuration = 300
const parEmail: TransportNotification = (dest, modele, variables, id) =>
  envoyerEmail(dest, modele as ModeleEmail, variables as VariablesEmail, id)
const parWhatsApp: TransportNotification = (dest, modele, variables, id) =>
  envoyerWhatsApp(dest, modele as ModeleWhatsApp, variables as VariablesWhatsApp, id)

export async function POST(request: NextRequest) {
  if (!requeteCronAutorisee(request.headers)) return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })
  const admin = creerClientAdmin()
  const echeance = Date.now() + 220_000
  // Un canal défaillant n'empêche pas le traitement des autres.
  const details: Record<string, Awaited<ReturnType<typeof viderNotifications>> | { erreur: string }> = {}
  for (const [nom, table, disponible, transport] of [
    ['grace', 'emails_a_envoyer', emailOperationnel(), parEmail],
    ['candidatures', 'notifications_candidature', emailOperationnel(), parEmail],
    ['whatsapp', 'notifications_whatsapp', whatsAppOperationnel(), parWhatsApp],
  ] as const) {
    try { details[nom] = await viderNotifications(admin, table, disponible, transport, 200, Math.min(echeance, Date.now() + 70_000)) }
    catch { details[nom] = { erreur: 'Traitement interrompu ; reprise conservée en file.' } }
  }
  const valeurs = Object.values(details)
  return NextResponse.json({
    traites: valeurs.reduce((n, v) => n + ('traites' in v ? v.traites : 0), 0),
    envoyes: valeurs.reduce((n, v) => n + ('envoyes' in v ? v.envoyes : 0), 0),
    echecs: valeurs.reduce((n, v) => n + ('echecs' in v ? v.echecs : 0), 0),
    detail: details,
  }, { status: valeurs.some(v => 'erreur' in v) ? 500 : 200 })
}
export async function GET(request: NextRequest) { return POST(request) }
