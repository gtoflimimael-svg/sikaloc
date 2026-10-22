import { NextResponse, type NextRequest } from 'next/server'

import { estAdminQuestions, origineInterneValide } from '@/lib/questions/admin'
import { obtenirUtilisateur } from '@/lib/supabase/serveur'
import { creerClientAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Parametres = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function reponse(erreur: string, statut: number) {
  return NextResponse.json({ erreur }, { status: statut, headers: { 'Cache-Control': 'no-store' } })
}

async function autoriser(request: NextRequest) {
  const user = await obtenirUtilisateur()
  if (!estAdminQuestions(user)) return false
  if (!origineInterneValide(request)) return false
  return true
}

export async function PATCH(request: NextRequest, { params }: Parametres) {
  if (!(await autoriser(request))) return reponse('Action non autorisée.', 404)
  const { id } = await params
  if (!UUID.test(id)) return reponse('Demande introuvable.', 404)

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return reponse('Statut invalide.', 400)
  }
  const statut = typeof corps === 'object' && corps !== null && 'statut' in corps ? corps.statut : null
  if (statut !== 'nouvelle' && statut !== 'en_cours' && statut !== 'repondue') {
    return reponse('Statut invalide.', 400)
  }

  const admin = creerClientAdmin()
  const maintenant = new Date().toISOString()
  const { data, error } = await admin
    .from('questions_visiteurs')
    .update({
      statut,
      repondue_le: statut === 'repondue' ? maintenant : null,
      modifie_le: maintenant,
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[questions/gestion] mise à jour impossible', error.code)
    return reponse('La demande n’a pas pu être mise à jour.', 503)
  }
  if (!data) return reponse('Demande introuvable.', 404)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: NextRequest, { params }: Parametres) {
  if (!(await autoriser(request))) return reponse('Action non autorisée.', 404)
  const { id } = await params
  if (!UUID.test(id)) return reponse('Demande introuvable.', 404)

  const admin = creerClientAdmin()
  const { data, error } = await admin
    .from('questions_visiteurs')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[questions/gestion] suppression impossible', error.code)
    return reponse('La demande n’a pas pu être supprimée.', 503)
  }
  if (!data) return reponse('Demande introuvable.', 404)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
