import { NextResponse, type NextRequest } from 'next/server'

import { requeteCronAutorisee } from '@/lib/cron-auth'
import { envoyerEmail, type ModeleEmail, type VariablesEmail } from '@/lib/emails'
import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Vide la file d'emails alimentée par le cycle de grâce.
 *
 * La file existe parce que les transitions de statut sont calculées en SQL par
 * pg_cron : Postgres ne peut pas appeler Resend, et surtout, faire dépendre
 * l'intégrité des statuts de la disponibilité d'un service tiers serait une
 * mauvaise idée. La base décide, cette route notifie.
 *
 * À planifier quotidiennement (Vercel Cron ou cron externe), après 03:00 UTC.
 */

const MAX_PAR_PASSAGE = 50
const MAX_TENTATIVES = 3

export async function POST(request: NextRequest) {
  if (!requeteCronAutorisee(request.headers)) {
    return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 })
  }

  const admin = creerClientAdmin()

  const { data: enAttente, error } = await admin
    .from('emails_a_envoyer')
    .select('*')
    .is('envoye_le', null)
    .lt('tentatives', MAX_TENTATIVES)
    .order('cree_le', { ascending: true })
    .limit(MAX_PAR_PASSAGE)

  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 500 })
  }

  let envoyes = 0
  let echecs = 0

  for (const message of enAttente ?? []) {
    const resultat = await envoyerEmail(
      message.destinataire,
      message.modele as ModeleEmail,
      (message.variables ?? {}) as VariablesEmail,
      // L'identifiant de la ligne sert de clé d'idempotence : un rejeu de la
      // file après incident ne produit pas de doublon chez le destinataire.
      message.id,
    )

    if (resultat.ok) {
      envoyes += 1
      await admin
        .from('emails_a_envoyer')
        .update({ envoye_le: new Date().toISOString(), derniere_erreur: null })
        .eq('id', message.id)
    } else {
      echecs += 1
      await admin
        .from('emails_a_envoyer')
        .update({
          tentatives: (message.tentatives ?? 0) + 1,
          derniere_erreur: resultat.message ?? 'échec inconnu',
        })
        .eq('id', message.id)
    }
  }

  return NextResponse.json({ traites: (enAttente ?? []).length, envoyes, echecs })
}

/** Même traitement en GET : Vercel Cron appelle ses routes en GET. */
export async function GET(request: NextRequest) {
  return POST(request)
}
