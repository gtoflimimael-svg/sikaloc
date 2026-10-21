import 'server-only'

import type { ResultatEnvoi } from '@/lib/emails'
import { creerClientAdmin } from '@/lib/supabase/admin'

export type FileNotification = 'emails_a_envoyer' | 'notifications_candidature' | 'notifications_whatsapp'
export type TransportNotification = (destinataire: string, modele: string, variables: Record<string, unknown>, idempotence: string) => Promise<ResultatEnvoi>

/** Une réservation par envoi : les suivants ne vieillissent pas pendant l’I/O. */
export async function viderNotifications(
  admin: ReturnType<typeof creerClientAdmin>,
  table: FileNotification,
  operationnel: boolean,
  envoyer: TransportNotification,
  limite = 200,
  echeance = Date.now() + 220_000,
) {
  const resultat = { traites: 0, envoyes: 0, echecs: 0, indisponible: !operationnel }
  while (resultat.traites < limite && Date.now() < echeance) {
    const reservation = await admin.rpc('reserver_notification', { p_file: table, p_operationnel: operationnel })
    if (reservation.error) throw new Error('Réservation de notification impossible.')
    const message = reservation.data?.[0]
    if (!message) break
    resultat.traites++
    let envoi: ResultatEnvoi
    try {
      envoi = await envoyer(String(message.destinataire), String(message.modele), (message.variables ?? {}) as Record<string, unknown>, String(message.id))
    } catch {
      envoi = { ok: false, etat: 'incertain' }
    }
    // « Accepté par le transport » ne prouve pas la réception dans la boîte finale.
    const confirme = envoi.ok && typeof envoi.id === 'string' && envoi.id.trim().length > 0
    const cloture = await admin.rpc('terminer_notification', {
      p_file: table, p_id: String(message.id), p_reservation: String(message.reservation),
      p_etat: confirme ? 'accepte' : envoi.ok ? 'incertain' : envoi.etat ?? 'temporaire',
      ...(confirme ? { p_transport_id: envoi.id } : {}),
    })
    if (cloture.error || !cloture.data) throw new Error('Clôture de notification non confirmée.')
    if (confirme) resultat.envoyes++
    else resultat.echecs++
  }
  return resultat
}
